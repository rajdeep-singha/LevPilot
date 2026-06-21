import { getSuiClient } from '../../config/sui.js';
import { fetchPrice } from './oracle.js';
import type { AssetSymbol } from '../../config/sui.js';

// ── Testnet Pool IDs ───────────────────────────────────────────────────────
// Source: MystenLabs/ts-sdks → packages/deepbook-v3/src/utils/constants.ts
// NOTE: Testnet uses synthetic tokens — DBUSDC (not real USDC), DBTC (not WBTC).
//       There is NO ETH/WETH pool on DeepBook v3 testnet.
//       Pool keys use _USDC suffix for compatibility with resolvePoolKey() below.
export const DEEPBOOK_POOLS: Record<string, string> = {
  'SUI_USDC':  '0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5', // SUI/DBUSDC
  'BTC_USDC':  '0x0dce0aa771074eb83d1f4a29d48be8248d4d2190976a5241f66b43ec18fa34de', // DBTC/DBUSDC
  // ETH/WETH pool does not exist on DeepBook v3 testnet — ETH trades unsupported
};

// Coin types on Sui testnet — only assets with verified DeepBook v3 pools
// Source: MystenLabs/ts-sdks packages/deepbook-v3/src/utils/constants.ts
export const COIN_TYPES: Record<string, string> = {
  SUI:    '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
  // Testnet uses DBUSDC (DeepBook synthetic USDC) — treat as USDC in the app
  USDC:   '0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::dbusdc::DBUSDC',
  // Testnet uses DBTC (DeepBook synthetic BTC) — treat as BTC in the app
  BTC:    '0xe4099a9e60c10e52c42b8e5e8aaeb3e30c36e46d1cfd7dab9d44a3c0e8d1a87::dbtc::DBTC',
  // ETH has no pool on DeepBook v3 testnet — omitted
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
