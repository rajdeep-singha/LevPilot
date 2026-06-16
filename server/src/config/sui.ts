import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { env } from './env.js';

// Singleton SuiClient — shared across all engines
let _client: SuiClient | null = null;

export function getSuiClient(): SuiClient {
  if (!_client) {
    const rpcUrl = env.SUI_RPC_URL || getFullnodeUrl(env.SUI_NETWORK);
    _client = new SuiClient({ url: rpcUrl });
    console.log(`✅ SuiClient connected → ${env.SUI_NETWORK} (${rpcUrl})`);
  }
  return _client;
}

// Known contract addresses — testnet defaults
export const CONTRACT_ADDRESSES = {
  deepbook: {
    packageId: env.DEEPBOOK_PACKAGE_ID,
    registryId: env.DEEPBOOK_REGISTRY_ID,
    // Common testnet pool IDs (SUI/USDC)
    pools: {
      SUI_USDC: '0x', // fill in with actual testnet pool ID
    },
  },
  scallop: {
    packageId: env.SCALLOP_PACKAGE_ID,
    versionId: env.SCALLOP_VERSION_ID,
  },
  pyth: {
    stateId: env.PYTH_STATE_ID,
    // Testnet price feed IDs
    priceFeeds: {
      SUI_USD: '0x50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266',
      BTC_USD: '0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b',
      ETH_USD: '0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6',
    },
  },
} as const;

export type AssetSymbol = 'SUI' | 'BTC' | 'ETH' | 'USDC' | 'USDT';