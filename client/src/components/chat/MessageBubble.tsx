import type { ChatMessage } from '../../types/trade'
import { TradeConfirm } from '../trade/TradeConfirm'
import type { ExecutionPlan } from '../../types/trade'

interface MessageBubbleProps {
  message: ChatMessage
  onApprove?: (plan: ExecutionPlan) => Promise<{ success: boolean; error?: string }>
  onReject?: (plan: ExecutionPlan) => void
}

export function MessageBubble({ message, onApprove, onReject }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] space-y-2`}>
        {/* Text bubble */}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-emerald-500/20 text-emerald-100 rounded-tr-sm'
              : 'bg-gray-800 text-gray-200 rounded-tl-sm'
          }`}
        >
          {message.content}
        </div>

        {/* Inline plan card */}
        {message.plan && onApprove && onReject && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <TradeConfirm plan={message.plan} onApprove={onApprove} onReject={onReject} />
          </div>
        )}
      </div>
    </div>
  )
}
