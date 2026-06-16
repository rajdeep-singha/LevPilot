import type { SuiTransactionBlockResponse } from '@mysten/sui/client';

export interface TxResult {
  success: boolean;
  planId: string;
  digest?: string;
  gasUsedMist?: string;
  error?: string;
  events?: unknown[];
  objectChanges?: unknown[];
  explorerUrl?: string;
}

/**
 * Parses a raw SuiTransactionBlockResponse into a clean TxResult.
 * Gas cost = computationCost + storageCost - storageRebate.
 */
export function parseTxResponse(
  response: SuiTransactionBlockResponse,
  planId: string,
  network: 'testnet' | 'mainnet' | 'devnet' | 'localnet' = 'testnet',
): TxResult {
  const effects = response.effects;
  const status = effects?.status?.status;
  const isSuccess = status === 'success';

  let gasUsedMist: string | undefined;
  if (effects?.gasUsed) {
    const { computationCost, storageCost, storageRebate } = effects.gasUsed;
    gasUsedMist = String(
      BigInt(computationCost) + BigInt(storageCost) - BigInt(storageRebate),
    );
  }

  const explorerUrl = response.digest
    ? `https://suiscan.xyz/${network}/tx/${response.digest}`
    : undefined;

  return {
    success: isSuccess,
    planId,
    digest: response.digest,
    gasUsedMist,
    error: !isSuccess ? (effects?.status?.error ?? 'Transaction failed') : undefined,
    events: response.events ?? [],
    objectChanges: response.objectChanges ?? [],
    explorerUrl,
  };
}
