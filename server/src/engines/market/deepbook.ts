import { getSuiClient } from '../../config/sui.js';
import { fetchPrice } from './oracle.js';
import type { AssetSymbol } from '../../config/sui.js';

// ── Testnet Pool IDs ───────────────────────────────────────────────────────
// Source: https://docs.deepbook.tech — fill in actual testnet addresses
// These are placeholders until verified from DeepBook testnet docs
export const DEEPBOOK_POOLS: Record<string, string> = {
  'SUI_USDC': '0x4405b50d791fd3346754e8171aaab6bc2ed26c2c46efdd033c14b30ae507ac33',
  'WETH_USDC': '0xf3114a74d54cbe56b3e68f9306661c043ede8c6615f0351b98f5360a8d95b387',
  'WBTC_USDC': '0xd109e39c3bb8a7ea96f8b8f8b2bab3a4c738a7efc8c03ae68b0fba42ae6c9a49',
};

// Coin types on Sui testnet
export const COIN_TYPES: Record<string, string> = {
  SUI: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
  USDC: '0xa1ec7fc00a6f40db9d4addba4e12769a539d7f746e82f35e47b99d76cfb38093::usdc::USDC',
  WETH: '0xf3e378f3d7571a94af8e28ff04fa5e32a04a1eb393de2b3d5b6b7fb85d32b37b::eth::ETH',
  WBTC: '0x4e9e39e2efc6ede2e7a2dd9eeaa49c35fcbf04d0fcb7f9c1b41e1b91e024a07::btc::BTC',
};

// ── Slippage Cache ─────────────────────────────────────────────────────────

interface SlippageCache {
  slippagePct: number;
  depthUsd: number;
  fetchedAt: number;
}

const slippageCache = new Map<string, SlippageCache>();
const CACHE_TTL_MS = 30_000; // 30 seconds

// ── Public API ─────────────────────────────────────────────────────────────

export interface SlippageEstimate {
  slippagePct: number;  // estimated price impact %
  depthUsd: number;     // total liquidity within 1% of mid
}

/**
 * Estimates slippage for a given trade size using DeepBook orderbook depth.
 * For Phase 2 we use a simplified linear model. Real orderbook walking
 * (getDynamicFields on the pool's bid/ask trees) can be added later.
 */
export async function estimateSlippage(
  fromAsset: string,
  toAsset: string,
  amountUsd: number,
): Promise<SlippageEstimate> {
  const cacheKey = `${fromAsset}_${toAsset}`;
  const cached = slippageCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    const slippagePct = linearSlippage(amountUsd, cached.depthUsd);
    return { slippagePct, depthUsd: cached.depthUsd };
  }

  const depthUsd = await fetchOrderbookDepth(fromAsset, toAsset);
  slippageCache.set(cacheKey, { slippagePct: 0, depthUsd, fetchedAt: Date.now() });

  return {
    slippagePct: linearSlippage(amountUsd, depthUsd),
    depthUsd,
  };
}

/**
 * Fetches approximate orderbook depth by querying the pool object.
 * Returns USD value of liquidity within 1% of mid price.
 */
async function fetchOrderbookDepth(
  fromAsset: string,
  toAsset: string,
): Promise<number> {
  const poolKey = resolvePoolKey(fromAsset, toAsset);
  const poolId = DEEPBOOK_POOLS[poolKey];

  if (!poolId || poolId === '0x') {
    // Pool ID not yet configured — return conservative fallback depth
    console.warn(`[DeepBook] Pool ID not set for ${poolKey}, using fallback depth`);
    return 250_000; // $250k fallback depth
  }

  try {
    const client = getSuiClient();
    const poolObj = await client.getObject({
      id: poolId,
      options: { showContent: true },
    });

    if (!poolObj.data?.content || poolObj.data.content.dataType !== 'moveObject') {
      return 250_000;
    }

    // Extract quote_asset_trading_fees as a proxy for pool activity
    // A real implementation would walk bid/ask dynamic fields
    const fields = (poolObj.data.content as { fields?: Record<string, unknown> }).fields ?? {};
    const baseAsset = fromAsset === 'USDC' ? toAsset : fromAsset;
    const price = await fetchPrice(baseAsset as AssetSymbol);

    // Use taker_fee_rate as a depth signal proxy — or default to $500k if unavailable
    const takerFeeRate = Number(fields['taker_fee_rate'] ?? 0);
    const estimatedDepth = takerFeeRate > 0 ? 500_000 : 250_000;

    return estimatedDepth * price;
  } catch (err) {
    console.warn(`[DeepBook] Depth fetch failed for ${poolKey}:`, err);
    return 250_000;
  }
}

/** Linear slippage model: slippage% = (trade size / depth) × 50bps */
function linearSlippage(amountUsd: number, depthUsd: number): number {
  if (depthUsd <= 0) return 5;
  return parseFloat(Math.min(10, (amountUsd / depthUsd) * 0.5).toFixed(3));
}

function resolvePoolKey(fromAsset: string, toAsset: string): string {
  const normalized: Record<string, string> = { WETH: 'ETH', WBTC: 'BTC' };
  const a = normalized[fromAsset] ?? fromAsset;
  const b = normalized[toAsset] ?? toAsset;

  // All pools are quoted in USDC
  if (b === 'USDC' || b === 'USDT') return `${a}_USDC`;
  if (a === 'USDC' || a === 'USDT') return `${b}_USDC`;
  return `${a}_${b}`;
}

/** Get pool ID for a given asset pair */
export function getPoolId(baseAsset: string, quoteAsset: string): string | undefined {
  const key = resolvePoolKey(baseAsset, quoteAsset);
  return DEEPBOOK_POOLS[key];
}

/** Get on-chain coin type string for a given asset symbol */
export function getCoinType(asset: string): string {
  return COIN_TYPES[asset] ?? COIN_TYPES['USDC'];
}
