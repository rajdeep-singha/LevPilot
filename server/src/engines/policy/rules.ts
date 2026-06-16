import type { PolicyConfig } from './policyTypes.js';

export const DEFAULT_POLICY: PolicyConfig = {
  maxLeverage: 5,
  maxLossPercent: 20,
  maxSlippagePercent: 2,
  minHealthFactor: 1.2,
  maxPositionSizeUsd: 100_000,
  minPositionSizeUsd: 10,
  allowedAssets: ['SUI', 'BTC', 'ETH'],
};

// Per-user overrides stored in memory (keyed by wallet address)
const userOverrides = new Map<string, Partial<PolicyConfig>>();

export function getPolicyForUser(walletAddress?: string): PolicyConfig {
  if (!walletAddress) return DEFAULT_POLICY;
  const override = userOverrides.get(walletAddress);
  if (!override) return DEFAULT_POLICY;
  return { ...DEFAULT_POLICY, ...override };
}

export function setUserPolicy(walletAddress: string, config: Partial<PolicyConfig>): void {
  userOverrides.set(walletAddress, { ...userOverrides.get(walletAddress), ...config });
}

export function resetUserPolicy(walletAddress: string): void {
  userOverrides.delete(walletAddress);
}
