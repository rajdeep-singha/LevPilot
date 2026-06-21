// Scallop market data via public REST API — no SDK needed for read-only queries
const SCALLOP_MARKET_URL = 'https://api.scallop.io/api/market';

export interface ScallopMarket {
  borrowAPY: Record<string, number>;       // asset → current borrow APY %
  supplyAPY: Record<string, number>;       // asset → current supply APY %
  collateralFactor: Record<string, number>; // asset → LTV (e.g. USDC = 0.90)
  availableLiquidityUsd: Record<string, number>;
}

interface MarketCache {
  data: ScallopMarket;
  fetchedAt: number;
}

let marketCache: MarketCache | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

// Reasonable fallback values if the API is unreachable
const FALLBACK_MARKET: ScallopMarket = {
  borrowAPY:   { SUI: 5.5, BTC: 2.8, ETH: 3.2, USDC: 4.5, USDT: 4.3 },
  supplyAPY:   { SUI: 4.2, BTC: 2.0, ETH: 2.5, USDC: 3.8, USDT: 3.6 },
  collateralFactor: { SUI: 0.75, BTC: 0.80, ETH: 0.80, USDC: 0.90, USDT: 0.90 },
  availableLiquidityUsd: { SUI: 2_000_000, BTC: 1_000_000, ETH: 1_500_000, USDC: 5_000_000, USDT: 3_000_000 },
};

interface ScallopApiAsset {
  coinName?: string;
  symbol?: string;
  borrowApy?: number;
  supplyApy?: number;
  maxCollateralFactor?: number;
  collateralFactor?: number;
  availableCash?: number;
}

interface ScallopApiResponse {
  data?: {
    pools?: Record<string, ScallopApiAsset>;
    collaterals?: Record<string, ScallopApiAsset>;
  };
}

export async function getScallopMarket(): Promise<ScallopMarket> {
  if (marketCache && Date.now() - marketCache.fetchedAt < CACHE_TTL_MS) {
    return marketCache.data;
  }

  try {
    const res = await fetch(SCALLOP_MARKET_URL, {
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) throw new Error(`Scallop API HTTP ${res.status}`);

    const raw = (await res.json()) as ScallopApiResponse;
    const market = parseScallopResponse(raw);

    marketCache = { data: market, fetchedAt: Date.now() };
    return market;
  } catch (err) {
    console.warn('[Scallop] Market fetch failed, using fallback:', err);
    return FALLBACK_MARKET;
  }
}

function parseScallopResponse(raw: ScallopApiResponse): ScallopMarket {
  const result: ScallopMarket = {
    borrowAPY: {},
    supplyAPY: {},
    collateralFactor: {},
    availableLiquidityUsd: {},
  };

  // Normalize Scallop API response — shape varies between versions
  const pools = raw?.data?.pools ?? {};
  const collaterals = raw?.data?.collaterals ?? {};

  for (const [key, pool] of Object.entries(pools)) {
    const symbol = normalizeSymbol(pool.symbol ?? pool.coinName ?? key);
    if (!symbol) continue;
    result.borrowAPY[symbol] = toPercent(pool.borrowApy ?? 0);
    result.supplyAPY[symbol] = toPercent(pool.supplyApy ?? 0);
    result.availableLiquidityUsd[symbol] = pool.availableCash ?? 0;
  }

  for (const [key, col] of Object.entries(collaterals)) {
    const symbol = normalizeSymbol(col.symbol ?? col.coinName ?? key);
    if (!symbol) continue;
    result.collateralFactor[symbol] =
      col.maxCollateralFactor ?? col.collateralFactor ?? FALLBACK_MARKET.collateralFactor[symbol] ?? 0.75;
  }

  // Fill any missing symbols from fallback
  for (const sym of ['SUI', 'BTC', 'ETH', 'USDC', 'USDT']) {
    result.borrowAPY[sym] ??= FALLBACK_MARKET.borrowAPY[sym];
    result.supplyAPY[sym] ??= FALLBACK_MARKET.supplyAPY[sym];
    result.collateralFactor[sym] ??= FALLBACK_MARKET.collateralFactor[sym];
    result.availableLiquidityUsd[sym] ??= FALLBACK_MARKET.availableLiquidityUsd[sym];
  }

  return result;
}

function normalizeSymbol(raw: string): string {
  const map: Record<string, string> = {
    wbtc: 'BTC', weth: 'ETH', sui: 'SUI', usdc: 'USDC', usdt: 'USDT',
    bitcoin: 'BTC', ethereum: 'ETH',
  };
  return map[raw.toLowerCase()] ?? raw.toUpperCase();
}

function toPercent(value: number): number {
  // Scallop may return rates as decimals (0.045) or percents (4.5) — normalise
  return value < 1 ? parseFloat((value * 100).toFixed(2)) : parseFloat(value.toFixed(2));
}

/** Get collateral factor for a specific asset */
export async function getCollateralFactor(asset: string): Promise<number> {
  const market = await getScallopMarket();
  return market.collateralFactor[asset] ?? 0.75;
}

/** Get current borrow APY for an asset */
export async function getBorrowAPY(asset: string): Promise<number> {
  const market = await getScallopMarket();
  return market.borrowAPY[asset] ?? 5.0;
}
