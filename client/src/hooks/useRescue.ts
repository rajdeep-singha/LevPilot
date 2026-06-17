import { useMemo } from 'react'
import { usePositionsStore } from '../app/Store'
import type { Position } from '../types/position'

const DANGER_HEALTH = 1.3
const WARNING_HEALTH = 1.5

export type RescueAlert = {
  position: Position
  severity: 'danger' | 'warning'
  message: string
}

export function useRescue() {
  const positions = usePositionsStore((s) => s.positions)

  const alerts = useMemo<RescueAlert[]>(() => {
    return positions
      .filter((p) => p.status === 'OPEN')
      .flatMap((p): RescueAlert[] => {
        if (p.healthFactor < DANGER_HEALTH) {
          return [
            {
              position: p,
              severity: 'danger',
              message: `${p.asset} ${p.side} position near liquidation (HF ${p.healthFactor.toFixed(2)})`,
            },
          ]
        }
        if (p.healthFactor < WARNING_HEALTH) {
          return [
            {
              position: p,
              severity: 'warning',
              message: `${p.asset} ${p.side} health factor low (HF ${p.healthFactor.toFixed(2)})`,
            },
          ]
        }
        return []
      })
  }, [positions])

  return { alerts, hasDanger: alerts.some((a) => a.severity === 'danger') }
}
