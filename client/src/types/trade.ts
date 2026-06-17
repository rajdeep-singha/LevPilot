import type { RiskReport } from './risk'

export type TradeAction = 'LONG' | 'SHORT' | 'EXIT' | 'REDUCE' | 'ADD_COLLATERAL' | 'REPAY'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type AssetSymbol = 'SUI' | 'BTC' | 'USDC' | 'USDT'
export type PlanStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED'
  | 'EXPIRED'
export type Protocol = 'DEEPBOOK' | 'SCALLOP' | 'SUI_NATIVE'
export type PlanStepType =
  | 'DEPOSIT_COLLATERAL'
  | 'BORROW'
  | 'SWAP'
  | 'OPEN_LONG'
  | 'OPEN_SHORT'
  | 'CLOSE_POSITION'
  | 'REDUCE_POSITION'
  | 'REPAY_DEBT'
  | 'WITHDRAW_COLLATERAL'

export interface TradeIntent {
  action: TradeAction
  asset: AssetSymbol
  collateral: AssetSymbol
  capital: number
  leverage: number
  risk: RiskLevel
  rawMessage: string
  timestamp: number
  positionId?: string
}

export interface PlanStep {
  stepIndex: number
  type: PlanStepType
  description: string
  protocol: Protocol
  params: Record<string, unknown>
}

export interface ExecutionPlan {
  id: string
  intent: TradeIntent
  steps: PlanStep[]
  riskReport: RiskReport
  policyCheckPassed: boolean
  policyViolation?: string
  estimatedGasBudget: string
  expiresAt: number
  status: PlanStatus
  createdAt: number
  walletAddress?: string
}

export type OrchestratorResponseType = 'PLAN' | 'CLARIFICATION' | 'ERROR' | 'POLICY_REJECTED'

export interface OrchestratorResponse {
  type: OrchestratorResponseType
  message: string
  plan?: ExecutionPlan
  planId?: string
}

export interface PTBBuildResult {
  txBytes: string
  gasBudget: string
}

export interface TxResult {
  success: boolean
  planId: string
  digest?: string
  gasUsedMist?: string
  error?: string
  explorerUrl?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  plan?: ExecutionPlan
  type?: OrchestratorResponseType
}
