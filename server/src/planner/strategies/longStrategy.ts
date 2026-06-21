import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import type { ExecutionPlan } from '../../types/plan.js';
import {
  resolveUserCoin,
  deepbookSwap,
  clockArg,
  deepbookRegistryArg,
  GAS_BUDGET_MIST,
} from '../ptbBuilder.js';
import { getPoolId } from '../../engines/market/deepbook.js';
import { fetchPrice } from '../../engines/market/oracle.js';
import { getSuiClient } from '../../config/sui.js';
import type { AssetSymbol } from '../../config/sui.js';

/**
 * TESTNET STUB — Scallop has no active testnet deployment.
 *
 * Simulates a leveraged LONG by executing only the DeepBook swap leg:
 *   User's SUI (capital) → DBUSDC via DeepBook SUI/USDC pool
 *
 * Production flow would be:
 *   1. Deposit collateral → Scallop
 *   2. Borrow USDC from Scallop (leverage - 1 × capital)
 *   3. Swap USDC → target asset on DeepBook
 */
export async function buildLongPTB(
  plan: ExecutionPlan,
  walletAddress: string,
): Promise<Transaction> {
  const { intent } = plan;

  // Convert USD capital → SUI units (9 decimals)
  const suiPrice = await fetchPrice('SUI' as AssetSymbol);
  const requestedUnits = BigInt(Math.floor((intent.capital / suiPrice) * 1e9));

  // Check user's actual SUI balance and cap to what's available (minus gas reserve)
  const client = getSuiClient();
  const balanceData = await client.getBalance({ owner: walletAddress });
  const availableUnits = BigInt(balanceData.totalBalance) - GAS_BUDGET_MIST - 10_000_000n; // 0.01 SUI extra reserve
  if (availableUnits <= 0n) {
    throw new Error('Insufficient SUI balance to cover gas. Please add more testnet SUI from the faucet.');
  }
  const capitalUnits = requestedUnits > availableUnits ? availableUnits : requestedUnits;
  const actualCapitalUsd = Number(capitalUnits) / 1e9 * suiPrice;

  // Min DBUSDC output with 5% slippage tolerance (DBUSDC = 6 decimals)
  const minUsdcOut = BigInt(Math.floor(actualCapitalUsd * 0.95 * 1e6));

  const poolId = getPoolId('SUI', 'USDC');
  if (!poolId || poolId === '0x') {
    throw new Error('No DeepBook SUI/USDC pool found on testnet');
  }

  const tx = new Transaction();
  tx.setSender(walletAddress);
  tx.setGasBudget(GAS_BUDGET_MIST);

  const clock = clockArg(tx);
  const registry = deepbookRegistryArg(tx);

  // Resolve user's SUI (split from gas coin)
  const suiCoin = await resolveUserCoin(tx, walletAddress, 'SUI', capitalUnits);

  // Swap SUI → DBUSDC on DeepBook (isBid=false: selling base SUI for quote USDC)
  const usdcOut = deepbookSwap(
    tx, poolId, suiCoin, 'SUI', 'USDC', minUsdcOut, false, clock, registry, walletAddress,
  );

  tx.transferObjects([usdcOut as unknown as TransactionObjectArgument], walletAddress);

  return tx;
}
