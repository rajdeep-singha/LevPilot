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

  // DeepBook testnet
  DEEPBOOK_PACKAGE_ID: z
    .string()
    .default('0x000000000000000000000000000000000000000000000000000000000000dee9'),
  DEEPBOOK_REGISTRY_ID: z
    .string()
    .default('0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d'),

  // Scallop testnet — verified from scallop-io/sui-scallop-sdk src/constants/testAddress.ts
  // core.packages.protocol.id → used as packageId for all Move calls
  SCALLOP_PACKAGE_ID: z
    .string()
    .default('0xb03fa00e2d9f17d78a9d48bd94d8852abec68c19d55e819096b1e062e69bfad1'),
  // core.version → first arg to every Scallop Move call
  SCALLOP_VERSION_ID: z
    .string()
    .default('0xee15d07800e2ad4852505c57cd86afea774af02c17388f8bd907de75f915b4f4'),

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
