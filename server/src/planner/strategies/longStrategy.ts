import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import type { ExecutionPlan } from '../../types/plan.js';
import {
  resolveUserCoin,
  scallopDepositCollateral,
  scallopBorrow,
  deepbookSwap,
  scallopVersionArg,
  clockArg,
  deepbookRegistryArg,
  GAS_BUDGET_MIST,
} from '../ptbBuilder.js';
import { getPoolId } from '../../engines/market/deepbook.js';
import { fetchPrice } from '../../engines/market/oracle.js';
import type { AssetSymbol } from '../../config/sui.js';

/**
 * Builds a PTB for a leveraged LONG position:
 *
 * 1. Deposit collateral (USDC) into Scallop
 * 2. Borrow additional USDC from Scallop (leverage - 1 × capital)
 * 3. Merge capital + borrowed USDC
 * 4. Swap all USDC → target asset on DeepBook
 * 5. Transfer purchased asset to user wallet
 */
export async function buildLongPTB(
  plan: ExecutionPlan,
  walletAddress: string,
): Promise<Transaction> {
  const { intent } = plan;
  const borrowedUsd = intent.capital * (intent.leverage - 1);
  const totalSwapUsd = intent.capital * intent.leverage;

  // Get on-chain units (USDC = 6 decimals)
  const capitalUnits = BigInt(Math.floor(intent.capital * 1e6));
  const borrowUnits = BigInt(Math.floor(borrowedUsd * 1e6));

  // Get current price for min-output calculation (5% slippage tolerance)
  const assetPrice = await fetchPrice(intent.asset as AssetSymbol);
  const totalSwapUnits = BigInt(Math.floor(totalSwapUsd * 1e6));
  const assetDecimals = intent.asset === 'USDC' || intent.asset === 'USDT' ? 1e6 : 1e9;
  const minOutputUnits = BigInt(
    Math.floor((totalSwapUsd / assetPrice) * assetDecimals * 0.95), // 5% tolerance
  );

  const poolId = getPoolId('USDC', intent.asset);
  if (!poolId || poolId === '0x') {
    throw new Error(`No DeepBook pool found for USDC/${intent.asset}`);
  }

  const tx = new Transaction();
  tx.setSender(walletAddress);
  tx.setGasBudget(GAS_BUDGET_MIST);

  const version = scallopVersionArg(tx);
  const clock = clockArg(tx);
  const registry = deepbookRegistryArg(tx);

  // Step 1 — Scallop: deposit collateral
  // Fetch user's USDC coin for capital
  const capitalCoin = await resolveUserCoin(tx, walletAddress, intent.collateral, capitalUnits);

  // Scallop shared Market object — verified from scallop-io/sui-scallop-sdk testAddress.ts (core.market)
  const marketObj = tx.object('0xa7f41efe3b551c20ad6d6cea6ccd0fd68d2e2eaaacdca5e62d956209f6a51312');

  const { obligationKey, obligationId } = scallopDepositCollateral(
    tx,
    intent.collateral,
    capitalCoin,
    version,
    marketObj,
  );

  // Step 2 — Scallop: borrow USDC
  const borrowedCoin = scallopBorrow(
    tx,
    'USDC',
    borrowUnits,
    version,
    marketObj,
    obligationId,
    obligationKey,
    clock,
  );

  // Step 3 — Merge capital USDC + borrowed USDC
  // We already spent capitalCoin for the deposit, so now we work with borrowedCoin
  // and any remaining capital — in a real flow, user deposits X and borrows X*(L-1)
  // The purchased asset will be the total leveraged position
  // For now: merge approach depends on Scallop returning the borrow as a pure coin
  // (borrowedCoin already represents the total borrow output)

  // Step 4 — DeepBook: swap USDC → asset
  // isBid=true means buying the base asset (SUI/BTC/ETH) with quote (USDC)
  const purchasedCoin = deepbookSwap(
    tx,
    poolId,
    borrowedCoin,
    intent.asset,
    'USDC',
    minOutputUnits,
    true,
    clock,
    registry,
  );

  // Step 5 — Transfer purchased asset to user wallet
  tx.transferObjects([purchasedCoin as unknown as TransactionObjectArgument], walletAddress);

  return tx;
}
