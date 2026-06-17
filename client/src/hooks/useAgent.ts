import { useCallback } from 'react'
import { useAgentStore, useWalletStore } from '../app/Store'
import { agentChat, agentApprovePlan, agentRejectPlan, buildPTB, confirmTrade } from '../lib/api'
import { signTransactionWithExtension } from '../lib/sui/wallet'
import type { ExecutionPlan } from '../types/trade'

export function useAgent() {
  const { messages, pendingPlan, isThinking, addMessage, setPendingPlan, setThinking, clearChat } =
    useAgentStore()
  const address = useWalletStore((s) => s.address)

  const sendMessage = useCallback(
    async (text: string) => {
      addMessage({ role: 'user', content: text })
      setThinking(true)
      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }))
        const res = await agentChat(text, address ?? undefined, history)

        addMessage({
          role: 'assistant',
          content: res.message,
          plan: res.plan,
          type: res.type,
        })

        if (res.plan && res.type === 'PLAN') {
          setPendingPlan(res.plan)
        }
      } catch (err) {
        addMessage({
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
          type: 'ERROR',
        })
      } finally {
        setThinking(false)
      }
    },
    [messages, address, addMessage, setThinking, setPendingPlan],
  )

  const approvePlan = useCallback(
    async (plan: ExecutionPlan): Promise<{ success: boolean; error?: string }> => {
      if (!address) return { success: false, error: 'Connect wallet first' }

      try {
        await agentApprovePlan(plan.id)
        const ptb = await buildPTB(plan.id, address)

        // Try extension signing
        const signed = await signTransactionWithExtension(ptb.txBytes)
        if (!signed) {
          // No extension — just set the plan as approved and show PTB bytes
          addMessage({
            role: 'assistant',
            content: `Plan approved. Sign the transaction in your wallet to execute.`,
          })
          setPendingPlan({ ...plan, status: 'APPROVED' })
          return { success: true }
        }

        const result = await confirmTrade(plan.id, ptb.txBytes, signed.signature)
        addMessage({
          role: 'assistant',
          content: result.success
            ? `Trade executed! Tx: ${result.digest ?? 'confirmed'}`
            : `Execution failed: ${result.error}`,
          type: result.success ? 'PLAN' : 'ERROR',
        })
        setPendingPlan(null)
        return { success: result.success, error: result.error }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Approval failed'
        addMessage({ role: 'assistant', content: `Error: ${msg}`, type: 'ERROR' })
        return { success: false, error: msg }
      }
    },
    [address, addMessage, setPendingPlan],
  )

  const rejectPlan = useCallback(
    async (plan: ExecutionPlan) => {
      try {
        await agentRejectPlan(plan.id)
        addMessage({ role: 'assistant', content: 'Plan rejected.' })
        setPendingPlan(null)
      } catch {
        setPendingPlan(null)
      }
    },
    [addMessage, setPendingPlan],
  )

  return { messages, pendingPlan, isThinking, sendMessage, approvePlan, rejectPlan, clearChat }
}
