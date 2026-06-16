import { z } from 'zod';
import 'dotenv/config';

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Anthropic — required
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

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

  // Scallop testnet
  SCALLOP_PACKAGE_ID: z
    .string()
    .default('0x4e10b4e4e30d69bb2a6b1a5c7a5d5e9b1d8b5e5d5e5d5e5d5e5d5e5d5e5d5e5'),
  SCALLOP_VERSION_ID: z
    .string()
    .default('0x07871c4b3c847a0f674510d4978d5cf6904c47a4c845eb68e4d3a6ac6e4bfe00'),

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
