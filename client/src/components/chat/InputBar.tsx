import { useState, type KeyboardEvent } from 'react'
import { Send, Zap } from 'lucide-react'
import { Spinner } from '../common/Spinner'

const QUICK = [
  'Long SUI $100 at 2x',
  'Short BTC $50 at 3x',
  'Show my positions',
  'What is my risk?',
]

interface InputBarProps {
  onSend: (message: string) => void
  disabled?: boolean
  loading?: boolean
}

export function InputBar({ onSend, disabled = false, loading = false }: InputBarProps) {
  const [value, setValue] = useState('')

  function submit() {
    const msg = value.trim()
    if (!msg || disabled || loading) return
    onSend(msg)
    setValue('')
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="space-y-2">
      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => onSend(q)}
            disabled={disabled || loading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-400 border border-gray-700/70 hover:border-emerald-500/40 hover:text-emerald-400 transition-all disabled:opacity-40"
          >
            <Zap size={9} />
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5 focus-within:border-emerald-500/40 transition-colors">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled || loading}
          placeholder="Ask LevPilot to trade, check risk, close positions…"
          className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none max-h-32 leading-relaxed"
        />
        <button
          onClick={submit}
          disabled={!value.trim() || disabled || loading}
          className="shrink-0 w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 flex items-center justify-center transition-all"
        >
          {loading ? <Spinner size="sm" className="border-black border-t-transparent" /> : <Send size={13} className="text-black" />}
        </button>
      </div>
    </div>
  )
}
