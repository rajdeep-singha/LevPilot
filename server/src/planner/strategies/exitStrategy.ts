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
import type { AssetSymbol } from '../../config/sui.js';

export interface ObligationRefs {
  obligationId: string;
  obligationKeyId: string;
}

/**
 * TESTNET STUB — Scallop has no active testnet deployment.
 *
 * Simulates a position exit by executing only the DeepBook swap leg:
 *   User's SUI → DBUSDC via DeepBook (proves swap pipeline works)
 *
 * Production flow would repay Scallop debt and withdraw collateral.
 */
export async function buildExitPTB(
  plan: ExecutionPlan,
  walletAddress: string,
  _positionSide: 'LONG' | 'SHORT' = 'LONG',
  _obligation: ObligationRefs,
): Promise<Transaction> {
  const { intent } = plan;
  const tx = new Transaction();
  tx.setSender(walletAddress);
  tx.setGasBudget(GAS_BUDGET_MIST);

  const clock = clockArg(tx);
  const registry = deepbookRegistryArg(tx);

  const suiPrice = await fetchPrice('SUI' as AssetSymbol);
  const capitalUnits = BigInt(Math.floor((intent.capital / suiPrice) * 1e9));
  const minUsdcOut = BigInt(Math.floor(intent.capital * 0.95 * 1e6));

  const poolId = getPoolId('SUI', 'USDC');
  if (!poolId || poolId === '0x') throw new Error('No DeepBook SUI/USDC pool found on testnet');

  const suiCoin = await resolveUserCoin(tx, walletAddress, 'SUI', capitalUnits);

  const usdcOut = deepbookSwap(
    tx, poolId, suiCoin, 'SUI', 'USDC', minUsdcOut, false, clock, registry, walletAddress,
  );

  tx.transferObjects([usdcOut as unknown as TransactionObjectArgument], walletAddress);

  return tx;
}
