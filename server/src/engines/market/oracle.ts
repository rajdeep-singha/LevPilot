import type { AssetSymbol } from '../../config/sui.js';

// Pyth Hermes REST — serves live price data, no SDK needed
const HERMES_URL = 'https://hermes.pyth.network/v2/updates/price/latest';

// Network-wide Pyth price feed IDs (same for testnet and mainnet via Hermes)
// ETH removed — no DeepBook v3 testnet pool, not a supported trading asset
const FEED_IDS: Partial<Record<AssetSymbol, string>> = {
  SUI: '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
};

const STABLE_PRICE: Partial<Record<AssetSymbol, number>> = {
  USDC: 1.0,
  USDT: 1.0,
};

interface PriceCache {
  price: number;
  conf: number;
  fetchedAt: number;
}

const cache = new Map<AssetSymbol, PriceCache>();
const CACHE_TTL_MS = 10_000; // 10 seconds

interface HermesResponse {
  parsed: Array<{
    price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
  }>;
}

async function fetchFromHermes(asset: AssetSymbol): Promise<PriceCache> {
  const feedId = FEED_IDS[asset];
  if (!feedId) throw new Error(`No Pyth feed ID for asset: ${asset}`);

  const url = `${HERMES_URL}?ids[]=${feedId}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });

  if (!res.ok) throw new Error(`Hermes HTTP ${res.status} for ${asset}`);

  const data = (await res.json()) as HermesResponse;
  const parsed = data.parsed?.[0];
  if (!parsed) throw new Error(`No price data returned for ${asset}`);

  const { price: rawPrice, conf: rawConf, expo } = parsed.price;
  // Pyth uses fixed-point: actual = rawPrice * 10^expo
  const multiplier = Math.pow(10, expo);
  const price = parseFloat(rawPrice) * multiplier;
  const conf = parseFloat(rawConf) * multiplier;

  return { price, conf, fetchedAt: Date.now() };
}

export async function fetchPriceWithConf(
  asset: AssetSymbol,
): Promise<{ price: number; conf: number }> {
  // Stablecoins — skip network call
  const stable = STABLE_PRICE[asset];
  if (stable !== undefined) return { price: stable, conf: 0 };

  const cached = cache.get(asset);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { price: cached.price, conf: cached.conf };
  }

  const fresh = await fetchFromHermes(asset);
  cache.set(asset, fresh);
  return { price: fresh.price, conf: fresh.conf };
}

export async function fetchPrice(asset: AssetSymbol): Promise<number> {
  const { price } = await fetchPriceWithConf(asset);
  return price;
}

/** Fetch multiple prices in parallel */
export async function fetchPrices(
  assets: AssetSymbol[],
): Promise<Record<string, number>> {
  const results = await Promise.all(assets.map((a) => fetchPrice(a)));
  return Object.fromEntries(assets.map((a, i) => [a, results[i]]));
}
