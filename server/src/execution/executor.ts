import { getSuiClient } from '../config/sui.js';
import { env } from '../config/env.js';
import { updatePlanStatus } from '../agent/orchestrator.js';
import { parseTxResponse, type TxResult } from './txResult.js';

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
