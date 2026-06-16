import { v4 as uuidv4 } from 'uuid';
import type { TradeIntent } from '../types/intent.js';
import type { ExecutionPlan, PlanStep } from '../types/plan.js';
import type { RiskReport } from '../types/risk.js';

const PLAN_TTL_MS = 5 * 60 * 1000;   // plans expire after 5 min
const GAS_BUDGET_MIST = '50000000';   // 0.05 SUI

export function generatePlan(
  intent: TradeIntent,
  riskReport: RiskReport,
  walletAddress?: string,
): ExecutionPlan {
  const steps = buildSteps(intent);
  const passed = riskReport.safe;

  return {
    id: uuidv4(),
    intent,
    steps,
    riskReport,
    policyCheckPassed: passed,
    estimatedGasBudget: GAS_BUDGET_MIST,
    expiresAt: Date.now() + PLAN_TTL_MS,
    status: passed ? 'PENDING_APPROVAL' : 'REJECTED',
    createdAt: Date.now(),
    walletAddress,
  };
}

// ── Step builders ──────────────────────────────────────────────────────────

function buildSteps(intent: TradeIntent): PlanStep[] {
  switch (intent.action) {
    case 'LONG':          return longSteps(intent);
    case 'SHORT':         return shortSteps(intent);
    case 'EXIT':          return exitSteps(intent);
    case 'REDUCE':        return reduceSteps(intent);
    case 'ADD_COLLATERAL': return addCollateralSteps(intent);
    case 'REPAY':         return repaySteps(intent);
    default:              return [];
  }
}

function longSteps(i: TradeIntent): PlanStep[] {
  const borrowed = i.capital * (i.leverage - 1);
  const totalBuy = i.capital * i.leverage;

  return [
    {
      stepIndex: 0,
      type: 'DEPOSIT_COLLATERAL',
      description: `Deposit $${fmt(i.capital)} ${i.collateral} as collateral into Scallop`,
      protocol: 'SCALLOP',
      params: { asset: i.collateral, amount: i.capital, amountUnits: usdToUnits(i.capital, i.collateral) },
    },
    {
      stepIndex: 1,
      type: 'BORROW',
      description: `Borrow $${fmt(borrowed)} USDC from Scallop (${i.leverage - 1}x borrowed leg)`,
      protocol: 'SCALLOP',
      params: { asset: 'USDC', amount: borrowed, amountUnits: usdToUnits(borrowed, 'USDC') },
    },
    {
      stepIndex: 2,
      type: 'SWAP',
      description: `Buy ${i.asset} with $${fmt(totalBuy)} USDC via DeepBook`,
      protocol: 'DEEPBOOK',
      params: { fromAsset: 'USDC', toAsset: i.asset, amountIn: totalBuy },
    },
    {
      stepIndex: 3,
      type: 'OPEN_LONG',
      description: `Record ${i.leverage}x LONG ${i.asset} position (size $${fmt(totalBuy)})`,
      protocol: 'DEEPBOOK',
      params: { asset: i.asset, leverage: i.leverage, size: totalBuy },
    },
  ];
}

function shortSteps(i: TradeIntent): PlanStep[] {
  const borrowed = i.capital * i.leverage;

  return [
    {
      stepIndex: 0,
      type: 'DEPOSIT_COLLATERAL',
      description: `Deposit $${fmt(i.capital)} ${i.collateral} as collateral into Scallop`,
      protocol: 'SCALLOP',
      params: { asset: i.collateral, amount: i.capital, amountUnits: usdToUnits(i.capital, i.collateral) },
    },
    {
      stepIndex: 1,
      type: 'BORROW',
      description: `Borrow ${i.asset} worth $${fmt(borrowed)} from Scallop to short`,
      protocol: 'SCALLOP',
      params: { asset: i.asset, amountUsd: borrowed },
    },
    {
      stepIndex: 2,
      type: 'SWAP',
      description: `Sell borrowed ${i.asset} for USDC via DeepBook`,
      protocol: 'DEEPBOOK',
      params: { fromAsset: i.asset, toAsset: 'USDC', amountInUsd: borrowed },
    },
    {
      stepIndex: 3,
      type: 'OPEN_SHORT',
      description: `Record ${i.leverage}x SHORT ${i.asset} position (size $${fmt(borrowed)})`,
      protocol: 'DEEPBOOK',
      params: { asset: i.asset, leverage: i.leverage, size: borrowed },
    },
  ];
}

function exitSteps(i: TradeIntent): PlanStep[] {
  return [
    {
      stepIndex: 0,
      type: 'CLOSE_POSITION',
      description: `Close ${i.asset} position via DeepBook`,
      protocol: 'DEEPBOOK',
      params: { asset: i.asset },
    },
    {
      stepIndex: 1,
      type: 'REPAY_DEBT',
      description: 'Repay outstanding Scallop debt',
      protocol: 'SCALLOP',
      params: { asset: i.collateral },
    },
    {
      stepIndex: 2,
      type: 'WITHDRAW_COLLATERAL',
      description: 'Withdraw remaining collateral from Scallop',
      protocol: 'SCALLOP',
      params: { asset: i.collateral },
    },
  ];
}

function reduceSteps(i: TradeIntent): PlanStep[] {
  return [
    {
      stepIndex: 0,
      type: 'REDUCE_POSITION',
      description: `Reduce ${i.asset} position by $${fmt(i.capital)} via DeepBook`,
      protocol: 'DEEPBOOK',
      params: { asset: i.asset, reduceByUsd: i.capital },
    },
    {
      stepIndex: 1,
      type: 'REPAY_DEBT',
      description: `Partially repay $${fmt(i.capital)} of Scallop debt`,
      protocol: 'SCALLOP',
      params: { asset: i.collateral, amount: i.capital },
    },
  ];
}

function addCollateralSteps(i: TradeIntent): PlanStep[] {
  return [
    {
      stepIndex: 0,
      type: 'DEPOSIT_COLLATERAL',
      description: `Add $${fmt(i.capital)} ${i.collateral} to Scallop obligation`,
      protocol: 'SCALLOP',
      params: { asset: i.collateral, amount: i.capital, amountUnits: usdToUnits(i.capital, i.collateral) },
    },
  ];
}

function repaySteps(i: TradeIntent): PlanStep[] {
  return [
    {
      stepIndex: 0,
      type: 'REPAY_DEBT',
      description: `Repay $${fmt(i.capital)} of Scallop debt`,
      protocol: 'SCALLOP',
      params: { asset: i.collateral, amount: i.capital, amountUnits: usdToUnits(i.capital, i.collateral) },
    },
  ];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Rough on-chain units — USDC/USDT = 6 decimals, others = 9 */
function usdToUnits(usdAmount: number, asset: string): string {
  const decimals = asset === 'USDC' || asset === 'USDT' ? 6 : 9;
  return Math.floor(usdAmount * 10 ** decimals).toString();
}
