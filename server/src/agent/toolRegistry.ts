import type { TradeIntent } from '../types/intent.js';
import type { RiskReport } from '../types/risk.js';

// ── Canonical function signatures ──────────────────────────────────────────
export type RiskEngineFunc = (intent: TradeIntent) => Promise<RiskReport>;

export interface MarketData {
  price: number;           // USD
  volume24h: number;       // USD
  orderBookDepth: number;  // USD liquidity within 1% of mid
  borrowAPY: number;       // Scallop current borrow rate %
  supplyAPY: number;
  lastUpdated: number;     // unix ms
}
export type MarketDataFunc = (asset: string) => Promise<MarketData>;

export interface PolicyResult {
  allowed: boolean;
  violations: string[];
}
export type PolicyCheckFunc = (intent: TradeIntent, risk: RiskReport) => PolicyResult;

export interface ToolRegistry {
  riskEngine: RiskEngineFunc;
  marketData: MarketDataFunc;
  policyCheck: PolicyCheckFunc;
}

// ── Stub implementations (replaced by real engines as they are built) ──────

const stubRiskEngine: RiskEngineFunc = async (intent) => {
  const scoreMap: Record<string, number> = { LOW: 30, MEDIUM: 55, HIGH: 78 };
  const bufferMap: Record<string, number> = { LOW: 40, MEDIUM: 22, HIGH: 11 };
  const score = scoreMap[intent.risk] ?? 55;
  const buffer = bufferMap[intent.risk] ?? 22;
  const slippage = 0.2 + intent.leverage * 0.15;
  const healthAfter = Math.max(1.0, 2.5 - (intent.leverage - 1) * 0.35);

  const warnings: string[] = [];
  if (intent.leverage >= 4) warnings.push(`${intent.leverage}x leverage — high liquidation risk`);
  if (slippage > 1.5) warnings.push(`Estimated slippage ${slippage.toFixed(2)}% is elevated`);

  return {
    riskScore: score,
    riskGrade: score < 40 ? 'A' : score < 60 ? 'B' : score < 75 ? 'C' : score < 88 ? 'D' : 'F',
    liquidationBuffer: buffer,
    estimatedSlippage: parseFloat(slippage.toFixed(2)),
    borrowAPY: 4.5,
    healthFactorAfter: parseFloat(healthAfter.toFixed(2)),
    warnings,
    safe: score < 80 && healthAfter >= 1.2,
  };
};

const stubMarketData: MarketDataFunc = async (asset) => {
  const prices: Record<string, number> = {
    SUI: 3.5,
    BTC: 65_000,
    ETH: 3_200,
    USDC: 1.0,
    USDT: 1.0,
  };
  return {
    price: prices[asset] ?? 1,
    volume24h: 12_000_000,
    orderBookDepth: 600_000,
    borrowAPY: 4.5,
    supplyAPY: 3.1,
    lastUpdated: Date.now(),
  };
};

const stubPolicyCheck: PolicyCheckFunc = (intent, risk) => {
  const violations: string[] = [];

  if (intent.leverage > 5)
    violations.push(`Leverage ${intent.leverage}x exceeds the 5x maximum`);
  if (intent.capital < 10)
    violations.push('Minimum trade size is $10');
  if (intent.capital > 100_000)
    violations.push('Maximum single-trade size is $100,000');
  if (risk.estimatedSlippage > 2)
    violations.push(`Estimated slippage ${risk.estimatedSlippage.toFixed(2)}% exceeds 2% limit`);
  if (risk.healthFactorAfter < 1.1)
    violations.push(`Health factor ${risk.healthFactorAfter.toFixed(2)} too close to liquidation`);

  return { allowed: violations.length === 0, violations };
};

// ── Singleton registry ─────────────────────────────────────────────────────

let _registry: ToolRegistry = {
  riskEngine: stubRiskEngine,
  marketData: stubMarketData,
  policyCheck: stubPolicyCheck,
};

export function getToolRegistry(): ToolRegistry {
  return _registry;
}

/** Swap a single tool implementation — called by each engine when it initialises */
export function registerTool<K extends keyof ToolRegistry>(name: K, fn: ToolRegistry[K]): void {
  _registry = { ..._registry, [name]: fn };
}
