import { getSuiClient } from '../config/sui.js';
import type { ExecutionPlan } from '../types/plan.js';
import { buildLongPTB } from './strategies/longStrategy.js';
import { buildShortPTB } from './strategies/shortStrategy.js';
import { buildExitPTB } from './strategies/exitStrategy.js';
import { getPosition } from '../routes/positions.js';

export interface PTBBuildResult {
  txBytes: string;      // base64-encoded unsigned PTB — send to client wallet for signing
  gasBudget: string;    // MIST
}

/**
 * Converts an approved ExecutionPlan into a serialised unsigned PTB.
 * The client signs this with their wallet and sends back the signature
 * to POST /trade/confirm.
 */
export async function planToTransaction(
  plan: ExecutionPlan,
  walletAddress: string,
): Promise<PTBBuildResult> {
  if (plan.status !== 'APPROVED') {
    throw new Error(`Plan ${plan.id} is not approved (status: ${plan.status})`);
  }

  const client = getSuiClient();
  let tx;

  switch (plan.intent.action) {
    case 'LONG':
      tx = await buildLongPTB(plan, walletAddress);
      break;

    case 'SHORT':
      tx = await buildShortPTB(plan, walletAddress);
      break;

    case 'EXIT':
    case 'REDUCE': {
      const positionId = plan.intent.positionId;
      if (!positionId) {
        throw new Error('EXIT/REDUCE plan is missing positionId in intent');
      }

      const position = getPosition(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found — may have been lost on restart`);
      }
      if (!position.scallopObligationId || !position.scallopObligationKeyId) {
        throw new Error(
          `Position ${positionId} is missing Scallop obligation IDs — cannot build exit PTB`,
        );
      }

      tx = await buildExitPTB(plan, walletAddress, position.side, {
        obligationId: position.scallopObligationId,
        obligationKeyId: position.scallopObligationKeyId,
      });
      break;
    }

    default:
      throw new Error(`No PTB strategy for action: ${plan.intent.action}`);
  }

  // Resolve object references and serialise to bytes
  const bytes = await tx.build({ client });
  const txBytes = Buffer.from(bytes).toString('base64');

  return { txBytes, gasBudget: plan.estimatedGasBudget };
}
