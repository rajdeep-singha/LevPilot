/**
 * Low-level Move call wrappers for Scallop and DeepBook.
 * Each function adds commands to an existing Transaction (PTB) object.
 *
 * IMPORTANT: The Move function signatures must exactly match the deployed
 * testnet packages. Verify against:
 *   Scallop:  https://github.com/scallop-io/sui-scallop-sdk
 *   DeepBook: https://docs.deepbook.tech
 */

import {
  Transaction,
  type TransactionArgument,
  type TransactionObjectArgument,
} from '@mysten/sui/transactions';
import { getSuiClient } from '../config/sui.js';
import { CONTRACT_ADDRESSES } from '../config/sui.js';
import { getCoinType } from '../engines/market/deepbook.js';

export const GAS_BUDGET_MIST = 200_000_000n; // 0.2 SUI — adjust after testnet profiling

// ── Coin resolution ────────────────────────────────────────────────────────

/**
 * Finds coin objects in the user's wallet and creates a TransactionArgument
 * for exactly `amountUnits` of a given coin type.
 *
 * For SUI: uses tx.gas (the gas coin) and splits from it.
 * For other tokens: fetches from SuiClient.getCoins and splits/merges.
 */
export async function resolveUserCoin(
  tx: Transaction,
  walletAddress: string,
  asset: string,
  amountUnits: bigint,
): Promise<TransactionObjectArgument> {
  const client = getSuiClient();
  const coinType = getCoinType(asset);

  // SUI uses the gas coin object directly
  if (asset === 'SUI') {
    const [splitCoin] = tx.splitCoins(tx.gas, [amountUnits]) as unknown as TransactionObjectArgument[];
    return splitCoin;
  }

  // Fetch user's coin objects for this token type
  const { data: coins } = await client.getCoins({
    owner: walletAddress,
    coinType,
    limit: 50,
  });

  if (!coins || coins.length === 0) {
    throw new Error(`No ${asset} coins found in wallet ${walletAddress}`);
  }

  // Sort descending by balance
  coins.sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)));

  const primaryCoin = tx.object(coins[0].coinObjectId);

  // Merge additional coins if needed to reach the required amount
  let totalBalance = BigInt(coins[0].balance);
  const toMerge: TransactionObjectArgument[] = [];

  for (let i = 1; i < coins.length && totalBalance < amountUnits; i++) {
    totalBalance += BigInt(coins[i].balance);
    toMerge.push(tx.object(coins[i].coinObjectId));
  }

  if (totalBalance < amountUnits) {
    throw new Error(
      `Insufficient ${asset} balance. Need ${amountUnits}, have ${totalBalance}`,
    );
  }

  if (toMerge.length > 0) {
    tx.mergeCoins(primaryCoin, toMerge);
  }

  // Split exact amount needed
  const [exactCoin] = tx.splitCoins(primaryCoin, [amountUnits]) as unknown as TransactionObjectArgument[];
  return exactCoin;
}

// ── Scallop wrappers ───────────────────────────────────────────────────────
// These call Scallop's core protocol Move functions.
// Function names and argument order must match the deployed Scallop package.

export interface ScallopDepositResult {
  obligationKey: TransactionArgument;
  obligationId: TransactionArgument;
}

/**
 * Deposits collateral into a Scallop obligation.
 * Creates a new obligation if obligationKeyArg is null.
 */
export function scallopDepositCollateral(
  tx: Transaction,
  collateralAsset: string,
  collateralCoin: TransactionArgument,
  scallopVersion: TransactionArgument,
  marketArg: TransactionArgument,
): ScallopDepositResult {
  const packageId = CONTRACT_ADDRESSES.scallop.packageId;
  const coinType = getCoinType(collateralAsset);

  // Create obligation + key
  const [obligationKey, obligation] = tx.moveCall({
    target: `${packageId}::open_obligation::open_obligation`,
    arguments: [scallopVersion],
  }) as unknown as [TransactionArgument, TransactionArgument];

  // Deposit collateral
  tx.moveCall({
    target: `${packageId}::deposit_collateral::deposit_collateral`,
    typeArguments: [coinType],
    arguments: [scallopVersion, marketArg, obligation, collateralCoin],
  });

  return { obligationKey, obligationId: obligation };
}

/**
 * Borrows an asset from Scallop against an existing obligation.
 * Returns the borrowed coin.
 */
export function scallopBorrow(
  tx: Transaction,
  borrowAsset: string,
  amountUnits: bigint,
  scallopVersion: TransactionArgument,
  marketArg: TransactionArgument,
  obligationArg: TransactionArgument,
  obligationKey: TransactionArgument,
  clockArg: TransactionArgument,
): TransactionArgument {
  const packageId = CONTRACT_ADDRESSES.scallop.packageId;
  const coinType = getCoinType(borrowAsset);

  const [borrowedCoin] = tx.moveCall({
    target: `${packageId}::borrow::borrow`,
    typeArguments: [coinType],
    arguments: [
      scallopVersion,
      marketArg,
      obligationArg,
      obligationKey,
      clockArg,
      tx.pure.u64(amountUnits),
    ],
  }) as unknown as [TransactionArgument];

  return borrowedCoin;
}

/**
 * Repays debt in a Scallop obligation.
 */
export function scallopRepay(
  tx: Transaction,
  repayAsset: string,
  repayCoin: TransactionArgument,
  scallopVersion: TransactionArgument,
  marketArg: TransactionArgument,
  obligationArg: TransactionArgument,
  clockArg: TransactionArgument,
): void {
  const packageId = CONTRACT_ADDRESSES.scallop.packageId;
  const coinType = getCoinType(repayAsset);

  tx.moveCall({
    target: `${packageId}::repay::repay`,
    typeArguments: [coinType],
    arguments: [scallopVersion, marketArg, obligationArg, clockArg, repayCoin],
  });
}

/**
 * Withdraws collateral from a Scallop obligation.
 * Returns the withdrawn coin.
 */
export function scallopWithdrawCollateral(
  tx: Transaction,
  collateralAsset: string,
  amountUnits: bigint,
  scallopVersion: TransactionArgument,
  marketArg: TransactionArgument,
  obligationArg: TransactionArgument,
  obligationKey: TransactionArgument,
  clockArg: TransactionArgument,
): TransactionArgument {
  const packageId = CONTRACT_ADDRESSES.scallop.packageId;
  const coinType = getCoinType(collateralAsset);

  const [withdrawnCoin] = tx.moveCall({
    target: `${packageId}::withdraw_collateral::withdraw_collateral`,
    typeArguments: [coinType],
    arguments: [
      scallopVersion,
      marketArg,
      obligationArg,
      obligationKey,
      clockArg,
      tx.pure.u64(amountUnits),
    ],
  }) as unknown as [TransactionArgument];

  return withdrawnCoin;
}

// ── DeepBook wrappers ──────────────────────────────────────────────────────

// DEEP token coin type on testnet — verified from on-chain pool module parameter types
const DEEP_COIN_TYPE =
  '0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP';

/**
 * Places a market order on a DeepBook V3 pool.
 * isBid = true  → buy base with quote (e.g. buy SUI with USDC) → swap_exact_quote_for_base
 * isBid = false → sell base for quote (e.g. sell SUI for USDC) → swap_exact_base_for_quote
 *
 * DeepBook V3 requires a DEEP fee coin on every swap. We pass a zero-balance
 * DEEP coin — any fee is deducted from the output or ignored if subsidised.
 * Type args are always [BaseCoinType, QuoteCoinType].
 * Returns the primary output coin (base when buying, quote when selling).
 */
export function deepbookSwap(
  tx: Transaction,
  poolId: string,
  inputCoin: TransactionArgument,
  baseAsset: string,
  quoteAsset: string,
  minOutputUnits: bigint,
  isBid: boolean,
  clockArg: TransactionArgument,
  _deepbookRegistry: TransactionArgument,
  senderAddress: string,
): TransactionArgument {
  const packageId = CONTRACT_ADDRESSES.deepbook.packageId;
  const baseCoinType = getCoinType(baseAsset);
  const quoteCoinType = getCoinType(quoteAsset);

  const pool = tx.object(poolId);

  // DeepBook V3 requires a DEEP fee coin on every swap; pass zero, remainder returned
  const [zeroDEEP] = tx.moveCall({
    target: '0x2::coin::zero',
    typeArguments: [DEEP_COIN_TYPE],
  }) as unknown as [TransactionObjectArgument];

  if (isBid) {
    // Buying base (e.g. SUI) with quote (e.g. USDC)
    const [baseCoinOut, quoteCoinOut, deepCoinOut] = tx.moveCall({
      target: `${packageId}::pool::swap_exact_quote_for_base`,
      typeArguments: [baseCoinType, quoteCoinType],
      arguments: [pool, inputCoin, zeroDEEP, tx.pure.u64(minOutputUnits), clockArg],
    }) as unknown as [TransactionObjectArgument, TransactionObjectArgument, TransactionObjectArgument];
    // Return dust (unused quote + unused DEEP) to sender
    tx.transferObjects([quoteCoinOut, deepCoinOut], senderAddress);
    return baseCoinOut;
  } else {
    // Selling base (e.g. SUI) for quote (e.g. USDC)
    const [baseCoinOut, quoteCoinOut, deepCoinOut] = tx.moveCall({
      target: `${packageId}::pool::swap_exact_base_for_quote`,
      typeArguments: [baseCoinType, quoteCoinType],
      arguments: [pool, inputCoin, zeroDEEP, tx.pure.u64(minOutputUnits), clockArg],
    }) as unknown as [TransactionObjectArgument, TransactionObjectArgument, TransactionObjectArgument];
    tx.transferObjects([baseCoinOut, deepCoinOut], senderAddress);
    return quoteCoinOut;
  }
}

// ── Shared object helpers ──────────────────────────────────────────────────

/**
 * Returns a TransactionArgument for the Scallop version shared object.
 * This is required as the first arg to almost all Scallop Move calls.
 */
export function scallopVersionArg(tx: Transaction): TransactionArgument {
  return tx.object(CONTRACT_ADDRESSES.scallop.versionId);
}

/**
 * Returns a TransactionArgument for the Sui clock (0x6).
 * Required by many time-sensitive Scallop and DeepBook calls.
 */
export function clockArg(tx: Transaction): TransactionArgument {
  return tx.object('0x0000000000000000000000000000000000000000000000000000000000000006');
}

/**
 * Returns a TransactionArgument for the DeepBook registry.
 */
export function deepbookRegistryArg(tx: Transaction): TransactionArgument {
  return tx.object(CONTRACT_ADDRESSES.deepbook.registryId);
}
