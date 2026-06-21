import { z } from 'zod';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// Load .env from project root (one level above server/)
config({ path: resolve(__dirname, '../../../.env') });

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Anthropic — required for agent features, optional for local dev
  ANTHROPIC_API_KEY: z.string().default(''),

  // Sui network
  SUI_NETWORK: z.enum(['testnet', 'mainnet', 'devnet', 'localnet']).default('testnet'),
  SUI_RPC_URL: z.string().optional(),

  // DeepBook testnet — verified from MystenLabs/ts-sdks packages/deepbook-v3/src/utils/constants.ts
  DEEPBOOK_PACKAGE_ID: z
    .string()
    .default('0xfb28c4cbc6865bd1c897d26aecbe1f8792d1509a20ffec692c800660cbec6982'),
  DEEPBOOK_REGISTRY_ID: z
    .string()
    .default('0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1'),

  // Scallop testnet — verified from scallop-io/sui-scallop-sdk src/constants/testAddress.ts (develop branch)
  // core.packages.protocol.id → used as packageId for all Move calls
  SCALLOP_PACKAGE_ID: z
    .string()
    .default('0xd971609b7feb6230585831e7aeb3c121fb21b9431337a30fc99185eb459a05ee'),
  // core.version → first arg to every Scallop Move call
  SCALLOP_VERSION_ID: z
    .string()
    .default('0x72bc09c4ce413d76d07f6e712413aebbe3ce3747eadfbc2331fbdb1dbde2d43a'),
  // core.market → Market shared object
  SCALLOP_MARKET_ID: z
    .string()
    .default('0xed80ed898df1e0b7a14b78c92527b47ef88591d5722ded16050d7e101687bb20'),

  // Pyth oracle testnet
  PYTH_STATE_ID: z
    .string()
    .default('0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c'),

  // Walrus testnet
  WALRUS_PUBLISHER_URL: z
    .string()
    .default('https://publisher.walrus-testnet.walrus.space'),
  WALRUS_AGGREGATOR_URL: z
    .string()
    .default('https://aggregator.walrus-testnet.walrus.space'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
