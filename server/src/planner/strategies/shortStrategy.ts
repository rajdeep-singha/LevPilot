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
 * Builds a PTB for a leveraged SHORT position:
 *
 * 1. Deposit collateral (USDC) into Scallop
 * 2. Borrow the target asset from Scallop (leverage × capital worth)
 * 3. Swap borrowed asset → USDC on DeepBook (selling = shorting)
 * 4. Transfer USDC proceeds to user wallet
 */
export async function buildShortPTB(
  plan: ExecutionPlan,
  walletAddress: string,
): Promise<Transaction> {
  const { intent } = plan;
  const capitalUnits = BigInt(Math.floor(intent.capital * 1e6)); // USDC = 6 decimals
  const borrowValueUsd = intent.capital * intent.leverage;

  // Borrow the base asset (e.g. SUI, ETH, BTC)
  const assetPrice = await fetchPrice(intent.asset as AssetSymbol);
  const assetDecimals = 1e9; // SUI/ETH/BTC all use 9 decimals on Sui
  const borrowUnits = BigInt(Math.floor((borrowValueUsd / assetPrice) * assetDecimals));

  // Min USDC output (5% slippage tolerance)
  const minUsdcOut = BigInt(Math.floor(borrowValueUsd * 0.95 * 1e6));

  const poolId = getPoolId(intent.asset, 'USDC');
  if (!poolId || poolId === '0x') {
    throw new Error(`No DeepBook pool found for ${intent.asset}/USDC`);
  }

  const tx = new Transaction();
  tx.setSender(walletAddress);
  tx.setGasBudget(GAS_BUDGET_MIST);

  const version = scallopVersionArg(tx);
  const clock = clockArg(tx);
  const registry = deepbookRegistryArg(tx);

  // Scallop shared Market object — verified from scallop-io/sui-scallop-sdk testAddress.ts (core.market)
  const marketObj = tx.object('0xa7f41efe3b551c20ad6d6cea6ccd0fd68d2e2eaaacdca5e62d956209f6a51312');

  // Step 1 — Deposit USDC collateral
  const capitalCoin = await resolveUserCoin(tx, walletAddress, intent.collateral, capitalUnits);
  const { obligationKey, obligationId } = scallopDepositCollateral(
    tx,
    intent.collateral,
    capitalCoin,
    version,
    marketObj,
  );

  // Step 2 — Borrow the base asset (e.g. SUI)
  const borrowedAssetCoin = scallopBorrow(
    tx,
    intent.asset,
    borrowUnits,
    version,
    marketObj,
    obligationId,
    obligationKey,
    clock,
  );

  // Step 3 — Sell borrowed asset for USDC on DeepBook
  // isBid=false means selling the base asset (SUI) for quote (USDC)
  const usdcProceeds = deepbookSwap(
    tx,
    poolId,
    borrowedAssetCoin,
    intent.asset,
    'USDC',
    minUsdcOut,
    false,
    clock,
    registry,
  );

  // Step 4 — Transfer USDC proceeds to user wallet
  tx.transferObjects([usdcProceeds as unknown as TransactionObjectArgument], walletAddress);

  return tx;
}
