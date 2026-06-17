import type { SuiObjectChange } from '@mysten/sui/client';
import { getSuiClient } from '../config/sui.js';
import { env } from '../config/env.js';
import { updatePlanStatus, getPlan } from '../agent/orchestrator.js';
import { parseTxResponse, type TxResult } from './txResult.js';
import { recordPosition, updatePosition } from '../routes/positions.js';
import { fetchPrice } from '../engines/market/oracle.js';
import type { Position } from '../types/position.js';
import type { AssetSymbol } from '../config/sui.js';
import { v4 as uuidv4 } from 'uuid';

export interface ExecuteParams {
  planId: string;
  txBytes: string;    // base64 unsigned PTB bytes (from transactionPlanner)
  signature: string;  // base64 ed25519 signature from client wallet
}

/**
 * Submits a signed PTB to the Sui network and parses the result.
 *
 * The client wallet flow:
 *   1. Server returns txBytes from POST /trade/build-ptb
 *   2. Client calls wallet.signTransaction({ transaction: txBytes })
 *   3. Client POSTs { planId, txBytes, signature } to /trade/confirm
 *   4. This function executes on-chain
 */
export async function executeSignedTransaction(params: ExecuteParams): Promise<TxResult> {
  const client = getSuiClient();
  const plan = getPlan(params.planId);
  updatePlanStatus(params.planId, 'EXECUTING');

  try {
    const response = await client.executeTransactionBlock({
      transactionBlock: params.txBytes,
      signature: params.signature,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });

    const result = parseTxResponse(
      response,
      params.planId,
      env.SUI_NETWORK as 'testnet' | 'mainnet' | 'devnet' | 'localnet',
    );

    updatePlanStatus(params.planId, result.success ? 'EXECUTED' : 'FAILED');

    if (result.success) {
      console.log(`✅ [Executor] tx ${result.digest} — gas: ${result.gasUsedMist} MIST`);

      // Record position on LONG/SHORT open; close on EXIT/REDUCE
      if (plan) {
        const action = plan.intent.action;
        if (action === 'LONG' || action === 'SHORT') {
          await openPositionFromTx(params.planId, plan, response.objectChanges ?? []);
        } else if (action === 'EXIT' || action === 'REDUCE') {
          if (plan.intent.positionId) {
            await updatePosition(plan.intent.positionId, { status: 'CLOSED' });
          }
        }
      }
    } else {
      console.error(`❌ [Executor] tx failed: ${result.error}`);
    }

    return result;
  } catch (err) {
    updatePlanStatus(params.planId, 'FAILED');
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Executor] Submission error for plan ${params.planId}:`, msg);
    return {
      success: false,
      planId: params.planId,
      error: `Submission failed: ${msg}`,
    };
  }
}

/**
 * Extracts Scallop obligation IDs from the transaction's object changes
 * and creates a Position record.
 *
 * When Scallop's open_obligation is called, it creates two objects:
 *   - Obligation (shared) — the collateral/debt tracker
 *   - ObligationKey (owned by user) — the capability NFT required to act on it
 */
async function openPositionFromTx(
  planId: string,
  plan: import('../types/plan.js').ExecutionPlan,
  objectChanges: SuiObjectChange[],
): Promise<void> {
  const { intent } = plan;

  // Find the obligation (shared object) and the obligation key (owned object)
  // Scallop obligation types contain "obligation" in their module path
  let obligationId: string | undefined;
  let obligationKeyId: string | undefined;

  for (const change of objectChanges) {
    if (change.type !== 'created') continue;
    const objType: string = (change as { objectType?: string }).objectType ?? '';
    if (objType.toLowerCase().includes('obligation_key')) {
      obligationKeyId = (change as { objectId?: string }).objectId;
    } else if (objType.toLowerCase().includes('obligation')) {
      obligationId = (change as { objectId?: string }).objectId;
    }
  }

  const assetPrice = await fetchPrice(intent.asset as AssetSymbol).catch(() => 0);
  const borrowedAmount = intent.capital * (intent.leverage - 1);
  const size = intent.capital * intent.leverage;

  // Liquidation price: collateral value drops below 110% of borrowed value
  // For LONG: price falls; for SHORT: price rises
  const ltv = 0.8; // approximate Scallop LTV
  const liquidationPrice =
    intent.action === 'LONG'
      ? assetPrice * (1 - (intent.capital / size) * (1 - 1 / ltv))
      : assetPrice * (1 + (intent.capital / size) * (1 - 1 / ltv));

  const position: Position = {
    id: uuidv4(),
    walletAddress: plan.walletAddress ?? '',
    side: intent.action as 'LONG' | 'SHORT',
    asset: intent.asset,
    collateralAsset: intent.collateral,
    collateralAmount: intent.capital,
    borrowedAmount,
    entryPrice: assetPrice,
    currentPrice: assetPrice,
    leverage: intent.leverage,
    size,
    pnl: 0,
    pnlPct: 0,
    healthFactor: 1.5, // will be updated by monitoring
    liquidationPrice,
    openedAt: Date.now(),
    updatedAt: Date.now(),
    status: 'OPEN',
    scallopObligationId: obligationId,
    scallopObligationKeyId: obligationKeyId,
    planId,
  };

  await recordPosition(position);
  console.log(
    `[Executor] Position ${position.id} opened — obligation: ${obligationId ?? 'not found in tx'}`,
  );
}
