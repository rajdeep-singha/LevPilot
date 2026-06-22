import { useCallback } from 'react'
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useAgentStore, useWalletStore, usePositionsStore, useTradeHistoryStore } from '../app/Store'
import { agentChat, agentApprovePlan, agentRejectPlan, buildPTB } from '../lib/api'
import type { ExecutionPlan } from '../types/trade'

export function useAgent() {
  const { messages, pendingPlan, isThinking, addMessage, setPendingPlan, setThinking, clearChat } =
    useAgentStore()
  const { setPositions, positions } = usePositionsStore()
  const mergePositions = useTradeHistoryStore((s) => s.mergePositions)
  const manualAddress = useWalletStore((s) => s.address)
  const currentAccount = useCurrentAccount()
  // Use dapp-kit connected account when available, fall back to manual address for chat/risk only
  const address = currentAccount?.address ?? manualAddress
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()

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
        // Must have a real wallet extension connected — manual address is not enough to sign
        if (!currentAccount) {
          addMessage({
            role: 'assistant',
            content: 'Please connect your Sui wallet extension (not just an address) to sign transactions. Click "Connect Wallet" and choose your extension.',
            type: 'ERROR',
          })
          return { success: false, error: 'Wallet extension required for signing' }
        }

        await agentApprovePlan(plan.id)
        const ptb = await buildPTB(plan.id, address!)

        // Deserialise tx bytes and send to wallet for signing + execution
        const txBytes = Uint8Array.from(atob(ptb.txBytes), (c) => c.charCodeAt(0))
        const tx = Transaction.from(txBytes)

        const result = await signAndExecute({ transaction: tx })

        addMessage({
          role: 'assistant',
          content: `Trade executed! [View on SuiScan](https://suiscan.xyz/testnet/tx/${result.digest})`,
          type: 'PLAN',
        })

        // Save to local history immediately — this persists through refresh/logout
        const intent = plan.intent as { action: string; asset: string; capital: number; leverage: number; collateral: string }
        const newPosition = {
          id: result.digest,
          walletAddress: address!,
          side: (intent.action === 'SHORT' ? 'SHORT' : 'LONG') as 'LONG' | 'SHORT',
          asset: intent.asset,
          collateralAsset: intent.collateral ?? 'SUI',
          collateralAmount: intent.capital,
          borrowedAmount: intent.capital * ((intent.leverage ?? 1) - 1),
          entryPrice: 0,
          currentPrice: 0,
          leverage: intent.leverage ?? 1,
          size: intent.capital * (intent.leverage ?? 1),
          pnl: 0,
          pnlPct: 0,
          healthFactor: 1.5,
          liquidationPrice: 0,
          openedAt: Date.now(),
          updatedAt: Date.now(),
          status: 'OPEN' as const,
          planId: result.digest,
        }
        setPositions([...positions, newPosition])
        mergePositions(address!, [newPosition])

        setPendingPlan(null)
        return { success: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Approval failed'
        addMessage({ role: 'assistant', content: `Error: ${msg}`, type: 'ERROR' })
        return { success: false, error: msg }
      }
    },
    [address, signAndExecute, addMessage, setPendingPlan, mergePositions, positions, setPositions],
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
