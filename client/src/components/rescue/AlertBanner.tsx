import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import type { RescueAlert } from '../../hooks/useRescue'

interface AlertBannerProps {
  alerts: RescueAlert[]
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = alerts.filter((a) => !dismissed.has(a.position.id))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((alert) => (
        <div
          key={alert.position.id}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs ${
            alert.severity === 'danger'
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
          }`}
        >
          <AlertTriangle size={14} className="shrink-0" />
          <p className="flex-1">{alert.message}</p>
          <button
            onClick={() => setDismissed((s) => new Set([...s, alert.position.id]))}
            className="opacity-50 hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
