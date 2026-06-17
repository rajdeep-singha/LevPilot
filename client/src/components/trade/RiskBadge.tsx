import type { RiskReport } from '../../types/risk'

interface RiskBadgeProps {
  report: RiskReport
  compact?: boolean
}

const gradeColors: Record<string, string> = {
  A: 'text-emerald-400 bg-emerald-400/10',
  B: 'text-green-400 bg-green-400/10',
  C: 'text-yellow-400 bg-yellow-400/10',
  D: 'text-orange-400 bg-orange-400/10',
  F: 'text-red-400 bg-red-400/10',
}

export function RiskBadge({ report, compact = false }: RiskBadgeProps) {
  const color = gradeColors[report.riskGrade] ?? 'text-gray-400 bg-gray-400/10'

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${color}`}>
        {report.riskGrade}
        <span className="font-normal opacity-70">{report.riskScore}</span>
      </span>
    )
  }

  return (
    <div className="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 uppercase tracking-wider">Risk Analysis</span>
        <span className={`px-2.5 py-1 rounded-lg text-sm font-bold ${color}`}>
          Grade {report.riskGrade} · {report.riskScore}/100
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="Liq. Buffer" value={`${report.liquidationBuffer.toFixed(1)}%`} ok={report.liquidationBuffer > 15} />
        <Metric label="Slippage" value={`${report.estimatedSlippage.toFixed(2)}%`} ok={report.estimatedSlippage < 1} />
        <Metric label="Borrow APY" value={`${report.borrowAPY.toFixed(2)}%`} ok={report.borrowAPY < 10} />
        <Metric label="Health After" value={report.healthFactorAfter.toFixed(2)} ok={report.healthFactorAfter >= 1.5} />
      </div>

      {report.warnings.length > 0 && (
        <div className="space-y-1">
          {report.warnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-400/80 flex items-start gap-1">
              <span>⚠</span> {w}
            </p>
          ))}
        </div>
      )}

      <div className={`text-xs font-medium ${report.safe ? 'text-emerald-400' : 'text-red-400'}`}>
        {report.safe ? '✓ Safe to execute' : '✗ Policy check failed'}
      </div>
    </div>
  )
}

function Metric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={ok ? 'text-gray-200' : 'text-yellow-400'}>{value}</span>
    </div>
  )
}
