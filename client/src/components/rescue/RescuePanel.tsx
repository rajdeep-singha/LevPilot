import { AlertTriangle } from 'lucide-react'
import type { RescueAlert } from '../../hooks/useRescue'
import { Button } from '../common/Button'

interface RescuePanelProps {
  alerts: RescueAlert[]
  onRescue: (positionId: string) => void
}

export function RescuePanel({ alerts, onRescue }: RescuePanelProps) {
  if (alerts.length === 0) return null

  return (
    <div className="bg-gray-900 border border-red-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-400" />
        <h3 className="text-sm font-semibold text-red-400">Rescue Required</h3>
      </div>

      {alerts.map((alert) => (
        <div
          key={alert.position.id}
          className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2"
        >
          <div>
            <p className="text-xs text-white font-medium">
              {alert.position.asset} {alert.position.side}
            </p>
            <p className="text-[11px] text-gray-400">HF: {alert.position.healthFactor.toFixed(2)}</p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onRescue(alert.position.id)}
          >
            Rescue
          </Button>
        </div>
      ))}

      <p className="text-[11px] text-gray-500">
        Type "rescue [positionId]" in chat to add collateral or repay debt.
      </p>
    </div>
  )
}
