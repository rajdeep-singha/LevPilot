import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getPlan } from '../agent/orchestrator.js';
import type { Position } from '../types/position.js';

export const positionsRouter = Router();

// In-memory position store — derived from executed plans.
// Later phases will query Scallop obligations + DeepBook orders on-chain for live data.
const positionStore = new Map<string, Position>();

/** Called by executor after a successful LONG/SHORT execution */
export function recordPosition(position: Position): void {
  positionStore.set(position.id, position);
}

/** Called by monitoring layer to update price / health factor */
export function updatePosition(id: string, updates: Partial<Position>): void {
  const pos = positionStore.get(id);
  if (pos) positionStore.set(id, { ...pos, ...updates, updatedAt: Date.now() });
}

/**
 * GET /positions/:address
 *
 * Returns all open positions for a wallet address.
 * Initially derived from executed plans; later will include live on-chain data.
 */
positionsRouter.get('/:address', (req: Request, res: Response) => {
  const parsed = z
    .object({ address: z.string().startsWith('0x') })
    .safeParse({ address: req.params.address });

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const { address } = parsed.data;
  const positions = Array.from(positionStore.values()).filter(
    (p) => p.walletAddress === address && p.status === 'OPEN',
  );

  return res.json(positions);
});

/**
 * GET /positions/:address/:positionId
 *
 * Returns a single position by ID.
 */
positionsRouter.get('/:address/:positionId', (req: Request, res: Response) => {
  const pos = positionStore.get(req.params.positionId);
  if (!pos || pos.walletAddress !== req.params.address) {
    return res.status(404).json({ error: 'Position not found' });
  }
  return res.json(pos);
});
