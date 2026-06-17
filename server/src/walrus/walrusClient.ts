import { env } from '../config/env.js';

export interface WalrusBlobResponse {
  newlyCreated?: { blobObject: { blobId: string } };
  alreadyCertified?: { blobId: string };
}

/**
 * Stores a JSON-serialisable value as a Walrus blob.
 * Returns the blob ID that can be used to retrieve it later.
 */
export async function walrusStore(data: unknown): Promise<string> {
  const body = JSON.stringify(data);

  const res = await fetch(`${env.WALRUS_PUBLISHER_URL}/v1/blobs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Walrus store failed HTTP ${res.status}: ${text}`);
  }

  const json = (await res.json()) as WalrusBlobResponse;
  const blobId =
    json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error(`Walrus store returned unexpected shape: ${JSON.stringify(json)}`);
  }

  return blobId;
}

/**
 * Retrieves and parses a JSON blob from Walrus by blob ID.
 */
export async function walrusRetrieve<T>(blobId: string): Promise<T> {
  const res = await fetch(`${env.WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Walrus retrieve failed HTTP ${res.status} for blob ${blobId}`);
  }

  return res.json() as Promise<T>;
}
