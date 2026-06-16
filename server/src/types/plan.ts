import type { TradeIntent } from './intent.js';
import type { RiskReport } from './risk.js';

export type PlanStepType =
  | 'DEPOSIT_COLLATERAL'
  | 'BORROW'
  | 'SWAP'
  | 'OPEN_LONG'
  | 'OPEN_SHORT'
  | 'CLOSE_POSITION'
  | 'REDUCE_POSITION'
  | 'REPAY_DEBT'
  | 'WITHDRAW_COLLATERAL';

export type Protocol = 'DEEPBOOK' | 'SCALLOP' | 'SUI_NATIVE';

export interface PlanStep {
  stepIndex: number;
  type: PlanStepType;
  description: string;
  protocol: Protocol;
  params: Record<string, unknown>;
}

export type PlanStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED'
  | 'EXPIRED';

export interface ExecutionPlan {
  id: string;
  intent: TradeIntent;
  steps: PlanStep[];
  riskReport: RiskReport;
  policyCheckPassed: boolean;
  policyViolation?: string;
  estimatedGasBudget: string; // in MIST (1 SUI = 1e9 MIST)
  expiresAt: number;          // unix ms — PTB must be signed before this
  status: PlanStatus;
  createdAt: number;
  walletAddress?: string;
}
