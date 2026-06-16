export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface RiskReport {
  riskScore: number;         // 0–100, higher = riskier
  riskGrade: RiskGrade;
  liquidationBuffer: number; // % distance from entry to liquidation price
  estimatedSlippage: number; // % price impact on DeepBook
  borrowAPY: number;         // current Scallop borrow rate %
  healthFactorAfter: number; // projected Scallop health factor post-trade
  warnings: string[];
  safe: boolean;             // overall go / no-go flag
}
