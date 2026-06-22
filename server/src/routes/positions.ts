import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { Position } from '../types/position.js';
import { persistPosition } from '../walrus/persist.js';
import { retrieveAllPositions } from '../walrus/retrieve.js';

export const positionsRouter = Router();

// ── Position store ─────────────────────────────────────────────────────────
// In-memory primary store — fast reads, restored from Walrus on startup.
// Index file maps positionId → latest Walrus blob ID for persistence across restarts.

const INDEX_FILE = '.position-index.json';
const positionStore = new Map<string, Position>();

function loadIndex(): Record<string, string> {
  if (!existsSync(INDEX_FILE)) return {};
  try {
    return JSON.parse(readFileSync(INDEX_FILE, 'utf-8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveIndex(index: Record<string, string>): void {
  try {
    writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  } catch (err) {
    console.warn('[Positions] Failed to write position index:', err);
  }
}

/** Restores positions from Walrus into memory on server startup */
async function restoreFromWalrus(): Promise<void> {
  const index = loadIndex();
  if (Object.keys(index).length === 0) return;

  console.log(`[Positions] Restoring ${Object.keys(index).length} positions from Walrus…`);
  const positions = await retrieveAllPositions(index);
  for (const pos of positions) {
    positionStore.set(pos.id, pos);
  }
  console.log(`[Positions] Restored ${positions.length} positions.`);
}

// Kick off restore on module load (non-blocking)
restoreFromWalrus().catch((err) =>
  console.warn('[Positions] Walrus restore failed, starting empty:', err),
);

// ── Write helpers ──────────────────────────────────────────────────────────

/** Called by executor after a successful LONG/SHORT execution */
export async function recordPosition(position: Position): Promise<void> {
  positionStore.set(position.id, position);

  // Persist to Walrus asynchronously — don't block the response
  persistPosition(position)
    .then((blobId) => {
      const index = loadIndex();
      index[position.id] = blobId;
      saveIndex(index);
      console.log(`[Positions] Persisted ${position.id} → Walrus blob ${blobId}`);
    })
    .catch((err) =>
      console.warn(`[Positions] Walrus persist failed for ${position.id}:`, err),
    );
}

/** Called by monitoring layer or executor to update price / health factor / status */
export async function updatePosition(id: string, updates: Partial<Position>): Promise<void> {
  const pos = positionStore.get(id);
  if (!pos) return;

  const updated = { ...pos, ...updates, updatedAt: Date.now() };
  positionStore.set(id, updated);

  // Persist updated snapshot to Walrus
  persistPosition(updated)
    .then((blobId) => {
      const index = loadIndex();
      index[id] = blobId; // overwrite with latest blob
      saveIndex(index);
    })
    .catch((err) =>
      console.warn(`[Positions] Walrus update persist failed for ${id}:`, err),
    );
}

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /positions/:address
 * Returns all open positions for a wallet address.
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
 * GET /positions/:address/all
 * Returns ALL positions (any status) for a wallet — used to hydrate client-side trade history.
 * Must be registered before /:address/:positionId to avoid route shadowing.
 */
positionsRouter.get('/:address/all', (req: Request, res: Response) => {
  const parsed = z
    .object({ address: z.string().startsWith('0x') })
    .safeParse({ address: req.params.address });

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const { address } = parsed.data;
  const positions = Array.from(positionStore.values()).filter(
    (p) => p.walletAddress === address,
  );

  return res.json(positions);
});

/**
 * GET /positions/:address/:positionId
 * Returns a single position by ID.
 */
positionsRouter.get('/:address/:positionId', (req: Request, res: Response) => {
  const pos = positionStore.get(req.params.positionId);
  if (!pos || pos.walletAddress !== req.params.address) {
    return res.status(404).json({ error: 'Position not found' });
  }
  return res.json(pos);
});

/** Exposed for executor to look up obligation IDs when building exit PTBs */
export function getPosition(positionId: string): Position | undefined {
  return positionStore.get(positionId);
}
