import { useState } from 'react'
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { ExecutionPlan } from '../../types/trade'
import { RiskBadge } from './RiskBadge'
import { Button } from '../common/Button'
import { formatMist } from '../../lib/sui/ptb'

interface TradeConfirmProps {
  plan: ExecutionPlan
  onApprove: (plan: ExecutionPlan) => Promise<{ success: boolean; error?: string }>
  onReject: (plan: ExecutionPlan) => void
}

export function TradeConfirm({ plan, onApprove, onReject }: TradeConfirmProps) {
  const [loading, setLoading] = useState(false)
  const [showSteps, setShowSteps] = useState(false)
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null)

  const { intent, steps, riskReport, estimatedGasBudget } = plan

  async function handleApprove() {
    setLoading(true)
    const r = await onApprove(plan)
    setResult(r)
    setLoading(false)
  }

  const timeLeft = Math.max(0, Math.floor((plan.expiresAt - Date.now()) / 1000))

  return (
    <div className="flex flex-col gap-3">
      {/* Intent summary */}
      <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`px-2.5 py-0.5 rounded text-xs font-bold ${
              intent.action === 'LONG'
                ? 'bg-emerald-500/20 text-emerald-400'
                : intent.action === 'SHORT'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-700 text-gray-300'
            }`}
          >
            {intent.action}
          </span>
          <span className="text-white font-semibold">{intent.asset}</span>
          <span className="text-gray-400 text-sm">· {intent.leverage}x</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-gray-500">Capital</p>
            <p className="text-white font-medium">${intent.capital.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Size</p>
            <p className="text-white font-medium">${(intent.capital * intent.leverage).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Gas</p>
            <p className="text-white font-medium">{formatMist(estimatedGasBudget)}</p>
          </div>
        </div>
        <p className="text-gray-600 text-xs mt-2">Expires in {timeLeft}s</p>
      </div>

      {/* Risk */}
      <RiskBadge report={riskReport} />

      {/* Steps toggle */}
      <button
        className="flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
        onClick={() => setShowSteps((v) => !v)}
      >
        <span>{steps.length} execution steps</span>
        {showSteps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showSteps && (
        <div className="space-y-1.5">
          {steps.map((step) => (
            <div key={step.stepIndex} className="flex items-start gap-2.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 shrink-0 mt-px">
                {step.stepIndex + 1}
              </span>
              <div>
                <p className="text-gray-300">{step.description}</p>
                <p className="text-gray-600">{step.protocol}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            result.success
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {result.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {result.success ? 'Trade submitted successfully' : result.error ?? 'Failed'}
        </div>
      )}

      {/* Actions */}
      {!result && (
        <div className="flex gap-2">
          <Button variant="danger" size="sm" className="flex-1" onClick={() => onReject(plan)} disabled={loading}>
            Reject
          </Button>
          <Button variant="primary" size="sm" className="flex-1" loading={loading} onClick={handleApprove}>
            Approve & Sign
          </Button>
        </div>
      )}
    </div>
  )
}
