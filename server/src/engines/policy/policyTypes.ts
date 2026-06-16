export interface PolicyConfig {
  maxLeverage: number;         // hard ceiling on leverage multiplier
  maxLossPercent: number;      // max tolerable drawdown %
  maxSlippagePercent: number;  // reject trade if estimatedSlippage exceeds this
  minHealthFactor: number;     // reject if projected HF falls below this
  maxPositionSizeUsd: number;  // single-trade cap
  minPositionSizeUsd: number;  // single-trade floor
  allowedAssets: string[];     // which base assets are permitted
}

export interface PolicyResult {
  allowed: boolean;
  violations: string[];
}
