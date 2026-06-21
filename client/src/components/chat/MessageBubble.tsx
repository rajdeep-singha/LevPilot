import type { ChatMessage, ExecutionPlan } from '../../types/trade'
import { TradeConfirm } from '../trade/TradeConfirm'

// Renders text and converts [label](url) markdown links to <a> tags
function MessageContent({ text }: { text: string }) {
  const parts = text.split(/(\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g)
  const elements: React.ReactNode[] = []
  let i = 0
  while (i < parts.length) {
    const part = parts[i]
    if (part.startsWith('[') && parts[i + 2]) {
      // This is a full match — label is parts[i+1], url is parts[i+2]
      elements.push(
        <a key={i} href={parts[i + 2]} target="_blank" rel="noopener noreferrer"
          className="text-emerald-400 underline hover:text-emerald-300">
          {parts[i + 1]}
        </a>
      )
      i += 3
    } else if (!part.match(/^\[/) && !part.match(/^https?:\/\//)) {
      if (part) elements.push(<span key={i}>{part}</span>)
      i++
    } else {
      i++
    }
  }
  return <>{elements}</>
}

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
          <MessageContent text={message.content} />
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
