/**
 * Retrieves position snapshots from Walrus blob storage and restores
 * the in-memory position store on server startup.
 */

import { walrusRetrieve } from './walrusClient.js';
import type { PositionSnapshot } from './persist.js';
import type { Position } from '../types/position.js';

/**
 * Fetches a single position by its Walrus blob ID.
 * Returns null if retrieval fails (blob expired, network error, etc.).
 */
export async function retrievePosition(blobId: string): Promise<Position | null> {
  try {
    const snapshot = await walrusRetrieve<PositionSnapshot>(blobId);
    if (snapshot.version !== 1 || !snapshot.position) return null;
    return snapshot.position;
  } catch (err) {
    console.warn(`[Walrus] Failed to retrieve position blob ${blobId}:`, err);
    return null;
  }
}

/**
 * Given a map of positionId → blobId, fetches all positions from Walrus.
 * Skips entries that fail (blob expired, etc.) without crashing.
 */
export async function retrieveAllPositions(
  index: Record<string, string>,
): Promise<Position[]> {
  const results = await Promise.allSettled(
    Object.values(index).map(retrievePosition),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<Position> =>
      r.status === 'fulfilled' && r.value !== null,
    )
    .map((r) => r.value);
}
