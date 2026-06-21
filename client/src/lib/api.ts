import type {
  OrchestratorResponse,
  ExecutionPlan,
  PTBBuildResult,
  TxResult,
  ChatMessage,
} from '../types/trade'
import type { Position } from '../types/position'

const BASE = 'http://localhost:3001'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

// ── Health ─────────────────────────────────────────────────────────────────

export async function getHealth() {
  return req<{ status: string; network: string; ts: number }>('/health')
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function authChallenge(walletAddress: string) {
  return req<{ nonce: string; message: string; expiresIn: number }>('/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ walletAddress }),
  })
}

export async function authVerify(walletAddress: string, nonce: string, signature: string) {
  return req<{ verified: boolean; walletAddress: string }>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, nonce, signature }),
  })
}

// ── Agent ──────────────────────────────────────────────────────────────────

export async function agentChat(
  message: string,
  walletAddress?: string,
  history: ChatMessage[] = [],
): Promise<OrchestratorResponse> {
  return req<OrchestratorResponse>('/agent/chat', {
    method: 'POST',
    headers: walletAddress ? { 'x-wallet-address': walletAddress } : {},
    body: JSON.stringify({ message, walletAddress, history }),
  })
}

export async function agentApprovePlan(planId: string): Promise<{ success: boolean; plan: ExecutionPlan }> {
  return req('/agent/approve', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  })
}

export async function agentRejectPlan(planId: string): Promise<{ success: boolean }> {
  return req('/agent/reject', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  })
}

export async function getPlan(planId: string): Promise<ExecutionPlan> {
  return req<ExecutionPlan>(`/agent/plan/${planId}`)
}

// ── Trade ──────────────────────────────────────────────────────────────────

export async function buildPTB(planId: string, walletAddress: string): Promise<PTBBuildResult> {
  return req<PTBBuildResult>('/trade/build-ptb', {
    method: 'POST',
    body: JSON.stringify({ planId, walletAddress }),
  })
}

export async function confirmTrade(
  planId: string,
  txBytes: string,
  signature: string,
): Promise<TxResult> {
  return req<TxResult>('/trade/confirm', {
    method: 'POST',
    body: JSON.stringify({ planId, txBytes, signature }),
  })
}

// ── Positions ──────────────────────────────────────────────────────────────

export async function getPositions(address: string): Promise<Position[]> {
  return req<Position[]>(`/positions/${address}`)
}

export async function getPosition(address: string, positionId: string): Promise<Position> {
  return req<Position>(`/positions/${address}/${positionId}`)
}
