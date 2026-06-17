/**
 * Persists a position snapshot to Walrus blob storage.
 *
 * Walrus is immutable — each write creates a new blob.
 * The caller is responsible for tracking the returned blob ID
 * (e.g. storing it in the position index).
 */

import { walrusStore } from './walrusClient.js';
import type { Position } from '../types/position.js';

export interface PositionSnapshot {
  version: 1;
  savedAt: number;
  position: Position;
}

/**
 * Serialises a position to Walrus and returns the new blob ID.
 * Throws if the Walrus publisher is unreachable — callers should handle gracefully.
 */
export async function persistPosition(position: Position): Promise<string> {
  const snapshot: PositionSnapshot = {
    version: 1,
    savedAt: Date.now(),
    position,
  };
  return walrusStore(snapshot);
}
