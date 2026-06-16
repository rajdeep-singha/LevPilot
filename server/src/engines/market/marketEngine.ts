import { registerTool } from '../../agent/toolRegistry.js';
import type { MarketDataFunc } from '../../agent/toolRegistry.js';
import { fetchPrice } from './oracle.js';
import { estimateSlippage } from './deepbook.js';
import { getScallopMarket } from './scallop.js';
import type { AssetSymbol } from '../../config/sui.js';

const marketDataFn: MarketDataFunc = async (asset) => {
  const [price, scallop, slippageData] = await Promise.all([
    fetchPrice(asset as AssetSymbol),
    getScallopMarket(),
    // Probe $10k trade to estimate depth/liquidity for this asset
    estimateSlippage(asset, 'USDC', 10_000),
  ]);

  return {
    price,
    volume24h: 0,  // not available from on-chain reads cheaply
    orderBookDepth: slippageData.depthUsd,
    borrowAPY: scallop.borrowAPY[asset] ?? 4.5,
    supplyAPY: scallop.supplyAPY[asset] ?? 3.1,
    lastUpdated: Date.now(),
  };
};

export function initMarketEngine(): void {
  registerTool('marketData', marketDataFn);
  console.log('✅ Market engine registered (Pyth + DeepBook + Scallop)');
}
