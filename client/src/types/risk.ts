export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface RiskReport {
  riskScore: number
  riskGrade: RiskGrade
  liquidationBuffer: number
  estimatedSlippage: number
  borrowAPY: number
  healthFactorAfter: number
  warnings: string[]
  safe: boolean
}
