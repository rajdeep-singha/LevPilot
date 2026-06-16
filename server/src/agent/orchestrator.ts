import Anthropic from '@anthropic-ai/sdk';
import { parseIntent } from './intentParser.js';
import { generatePlan } from './planGenerator.js';
import { getToolRegistry } from './toolRegistry.js';
import type { ExecutionPlan } from '../types/plan.js';
import type { TradeIntent } from '../types/intent.js';
import type { RiskReport } from '../types/risk.js';
import type { MarketData } from './toolRegistry.js';

const client = new Anthropic();

// ── In-memory plan store (swap for Redis in production) ────────────────────
const planStore = new Map<string, ExecutionPlan>();

// ── Public types ───────────────────────────────────────────────────────────

export type OrchestratorResponseType = 'PLAN' | 'CLARIFICATION' | 'ERROR' | 'POLICY_REJECTED';

export interface OrchestratorResponse {
  type: OrchestratorResponseType;
  message: string;       // human-readable, sent directly to chat UI
  plan?: ExecutionPlan;  // present only when type === 'PLAN'
  planId?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Core pipeline ──────────────────────────────────────────────────────────

/**
 * Main entry point.
 * Runs: message → intent → market data → risk → policy → plan → explanation
 * Returns a plan awaiting wallet approval, or a clarification / rejection.
 */
export async function orchestrateChat(
  userMessage: string,
  walletAddress?: string,
  _conversationHistory: ChatMessage[] = [],
): Promise<OrchestratorResponse> {
  const registry = getToolRegistry();

  // 1. Parse intent with Claude
  const intentResult = await parseIntent(userMessage);

  if (!intentResult.success) {
    if (intentResult.clarification) {
      return { type: 'CLARIFICATION', message: intentResult.clarification };
    }
    return {
      type: 'ERROR',
      message: intentResult.error ?? 'Could not understand your request. Please try again.',
    };
  }

  const intent = intentResult.intent!;

  // 2. Fetch market data (parallel with risk — both are independent)
  const [marketData, riskReport] = await Promise.all([
    registry.marketData(intent.asset),
    registry.riskEngine(intent),
  ]);

  // 3. Policy gate
  const policy = registry.policyCheck(intent, riskReport);
  if (!policy.allowed) {
    return {
      type: 'POLICY_REJECTED',
      message: policyRejectionMessage(intent, policy.violations),
    };
  }

  // 4. Build execution plan
  const plan = generatePlan(intent, riskReport, walletAddress);
  planStore.set(plan.id, plan);

  // 5. Generate plain-English explanation
  const message = await buildExplanation(intent, riskReport, marketData, plan);

  return { type: 'PLAN', message, plan, planId: plan.id };
}

// ── Plan lifecycle ─────────────────────────────────────────────────────────

/** Called when user taps "Approve" in the chat UI */
export async function approvePlan(planId: string): Promise<ExecutionPlan | null> {
  const plan = planStore.get(planId);
  if (!plan || plan.status !== 'PENDING_APPROVAL') return null;
  if (Date.now() > plan.expiresAt) {
    plan.status = 'EXPIRED';
    return null;
  }
  plan.status = 'APPROVED';
  return plan;
}

/** Called when user taps "Reject" */
export function rejectPlan(planId: string): void {
  const plan = planStore.get(planId);
  if (plan?.status === 'PENDING_APPROVAL') plan.status = 'REJECTED';
}

export function getPlan(planId: string): ExecutionPlan | undefined {
  return planStore.get(planId);
}

export function updatePlanStatus(
  planId: string,
  status: ExecutionPlan['status'],
): void {
  const plan = planStore.get(planId);
  if (plan) plan.status = status;
}

// ── Explanation builder ────────────────────────────────────────────────────

async function buildExplanation(
  intent: TradeIntent,
  risk: RiskReport,
  market: MarketData,
  plan: ExecutionPlan,
): Promise<string> {
  const stepList = plan.steps
    .map((s) => `  ${s.stepIndex + 1}. ${s.description}`)
    .join('\n');

  const prompt = `You are LevPilot, a DeFi leverage trading assistant on Sui testnet.
Explain this trade plan to the user in 3-4 concise sentences. Highlight the key risk number.
Do NOT use markdown headers or bullet lists — plain conversational text only.

Trade: ${intent.leverage}x ${intent.action} ${intent.asset} with $${intent.capital} capital
${intent.asset} price: $${market.price}
Risk Score: ${risk.riskScore}/100 (${risk.riskGrade}) — ${risk.safe ? 'SAFE' : 'UNSAFE'}
Liquidation Buffer: ${risk.liquidationBuffer}%
Slippage: ~${risk.estimatedSlippage}%
Borrow APY: ${risk.borrowAPY}%
Health Factor After: ${risk.healthFactorAfter}
Warnings: ${risk.warnings.length ? risk.warnings.join('; ') : 'none'}

Steps:
${stepList}

End your message with: "Ready — approve the transaction in your wallet to proceed."`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text : fallbackExplanation(intent, risk, plan);
  } catch {
    return fallbackExplanation(intent, risk, plan);
  }
}

function fallbackExplanation(
  intent: TradeIntent,
  risk: RiskReport,
  plan: ExecutionPlan,
): string {
  return (
    `Opening a ${intent.leverage}x ${intent.action} on ${intent.asset} using $${intent.capital}. ` +
    `Risk score ${risk.riskScore}/100, liquidation buffer ${risk.liquidationBuffer}%. ` +
    `This executes ${plan.steps.length} on-chain steps via Scallop + DeepBook. ` +
    `Ready — approve the transaction in your wallet to proceed.`
  );
}

function policyRejectionMessage(intent: TradeIntent, violations: string[]): string {
  const lines = violations.map((v) => `• ${v}`).join('\n');
  return (
    `Trade rejected by the policy engine for ${intent.leverage}x ${intent.action} ${intent.asset}:\n\n` +
    lines +
    '\n\nPlease adjust your trade parameters and try again.'
  );
}
