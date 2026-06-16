import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getPlan } from '../agent/orchestrator.js';
import { planToTransaction } from '../planner/transactionPlanner.js';
import { executeSignedTransaction } from '../execution/executor.js';

export const tradeRouter = Router();

// ── Schemas ────────────────────────────────────────────────────────────────

const BuildPTBSchema = z.object({
  planId: z.string().uuid(),
  walletAddress: z.string().startsWith('0x'),
});

const ConfirmSchema = z.object({
  planId: z.string().uuid(),
  txBytes: z.string().min(1),    // base64 PTB (same bytes returned by build-ptb)
  signature: z.string().min(1),  // base64 wallet signature
});

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /trade/build-ptb
 *
 * Called after the user approves a plan.
 * Server builds the unsigned PTB and returns base64 bytes for wallet signing.
 *
 * Client flow:
 *   1. POST /agent/approve  → plan.status = APPROVED
 *   2. POST /trade/build-ptb → { txBytes, gasBudget }
 *   3. wallet.signTransaction(txBytes) → { signature }
 *   4. POST /trade/confirm → execute on-chain
 */
tradeRouter.post('/build-ptb', async (req: Request, res: Response) => {
  const parsed = BuildPTBSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  const { planId, walletAddress } = parsed.data;
  const plan = getPlan(planId);

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  if (plan.status !== 'APPROVED') {
    return res.status(400).json({
      error: `Plan is not approved (current status: ${plan.status})`,
    });
  }
  if (Date.now() > plan.expiresAt) {
    return res.status(400).json({ error: 'Plan has expired — please start a new trade' });
  }

  try {
    const ptb = await planToTransaction(plan, walletAddress);
    return res.json(ptb);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'PTB build failed';
    console.error('[/trade/build-ptb]', msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /trade/confirm
 *
 * Client sends back the wallet-signed transaction.
 * Server submits it to the Sui network and returns the result.
 */
tradeRouter.post('/confirm', async (req: Request, res: Response) => {
  const parsed = ConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  try {
    const result = await executeSignedTransaction(parsed.data);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Execution failed';
    return res.status(500).json({ error: msg });
  }
});
