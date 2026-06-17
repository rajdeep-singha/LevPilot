import { useEffect, useRef } from 'react'
import { Bot, Trash2 } from 'lucide-react'
import { useAgent } from '../../hooks/useAgent'
import { useWallet } from '../../hooks/useWallet'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { Spinner } from '../common/Spinner'
import { RescuePanel } from '../rescue/RescuePanel'
import { useRescue } from '../../hooks/useRescue'

export function ChatWindow() {
  const { messages, pendingPlan, isThinking, sendMessage, approvePlan, rejectPlan, clearChat } =
    useAgent()
  const { connected } = useWallet()
  const { alerts } = useRescue()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  function handleRescue(positionId: string) {
    sendMessage(`rescue position ${positionId} — add collateral to prevent liquidation`)
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-xl border border-gray-800/60">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Bot size={14} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">LevPilot AI</p>
            <p className="text-[10px] text-gray-500">Powered by Claude · Scallop + DeepBook</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-gray-600 hover:text-gray-400 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Rescue alerts */}
      {alerts.length > 0 && (
        <div className="px-4 pt-3">
          <RescuePanel alerts={alerts} onRescue={handleRescue} />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Bot size={24} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-300">Ready to trade</p>
              <p className="text-xs text-gray-600 mt-1">
                {connected
                  ? 'Type a message or use a quick action below'
                  : 'Connect your wallet to start trading'}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            onApprove={approvePlan}
            onReject={rejectPlan}
          />
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-gray-500">
            <Spinner size="sm" />
            <span className="text-xs">Analyzing market conditions…</span>
          </div>
        )}

        {/* Pending plan banner (if plan came without inline display) */}
        {pendingPlan && pendingPlan.status === 'PENDING_APPROVAL' && !messages.find((m) => m.plan?.id === pendingPlan.id) && (
          <div className="bg-gray-900 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-xs text-emerald-400 mb-2 font-medium">Pending Plan · {pendingPlan.intent.action} {pendingPlan.intent.asset}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-800/60">
        <InputBar onSend={sendMessage} loading={isThinking} disabled={!connected} />
        {!connected && (
          <p className="text-[10px] text-gray-600 text-center mt-2">Connect a wallet to enable trading</p>
        )}
      </div>
    </div>
  )
}
