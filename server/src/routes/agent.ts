import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  orchestrateChat,
  approvePlan,
  rejectPlan,
  getPlan,
} from '../agent/orchestrator.js';

export const agentRouter = Router();

// ── Schemas ────────────────────────────────────────────────────────────────

const ChatSchema = z.object({
  message: z.string().min(1).max(2000),
  walletAddress: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
});

const PlanIdSchema = z.object({
  planId: z.string().uuid(),
});

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /agent/chat
 * Main chat endpoint — parses intent, runs risk + policy, returns execution plan.
 */
agentRouter.post('/chat', async (req: Request, res: Response) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  const { message, walletAddress, history } = parsed.data;
  const wallet = walletAddress ?? (req as Request & { walletAddress?: string }).walletAddress;

  try {
    const result = await orchestrateChat(message, wallet, history);
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Orchestration failed';
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /agent/approve
 * User approves a pending plan (before wallet signature).
 */
agentRouter.post('/approve', async (req: Request, res: Response) => {
  const parsed = PlanIdSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid planId — must be a UUID' });
  }

  const plan = await approvePlan(parsed.data.planId);
  if (!plan) {
    return res.status(404).json({
      error: 'Plan not found, already processed, or expired (plans expire after 5 minutes)',
    });
  }

  return res.json({ success: true, plan });
});

/**
 * POST /agent/reject
 * User rejects a pending plan.
 */
agentRouter.post('/reject', (req: Request, res: Response) => {
  const parsed = PlanIdSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid planId' });
  }

  rejectPlan(parsed.data.planId);
  return res.json({ success: true });
});

/**
 * GET /agent/plan/:planId
 * Poll plan status — used by client after wallet signature.
 */
agentRouter.get('/plan/:planId', (req: Request, res: Response) => {
  const plan = getPlan(req.params.planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  return res.json(plan);
});
