import type { AssetSymbol } from '../../config/sui.js';

// Pyth Hermes REST — serves live price data, no SDK needed
const HERMES_URL = 'https://hermes.pyth.network/v2/updates/price/latest';

// Network-wide Pyth price feed IDs (same for testnet and mainnet via Hermes)
const FEED_IDS: Partial<Record<AssetSymbol, string>> = {
  SUI: '0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266',
  BTC: '0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b',
  ETH: '0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6',
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
