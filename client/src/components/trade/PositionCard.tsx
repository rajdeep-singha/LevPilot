import type { Position } from '../../types/position'

interface PositionCardProps {
  position: Position
  onClose?: (position: Position) => void
}

function pnlClass(pnl: number) {
  return pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
}

function hfClass(hf: number) {
  if (hf < 1.3) return 'text-red-400'
  if (hf < 1.5) return 'text-yellow-400'
  return 'text-emerald-400'
}

export function PositionCard({ position, onClose }: PositionCardProps) {
  const {
    asset,
    side,
    size,
    leverage,
    entryPrice,
    currentPrice,
    pnl,
    pnlPct,
    healthFactor,
    liquidationPrice,
    collateralAmount,
  } = position

  return (
    <div className="grid grid-cols-8 gap-2 items-center px-4 py-3 text-xs border-b border-gray-800/60 hover:bg-gray-800/20 transition-colors">
      {/* Asset + Side */}
      <div className="col-span-1 flex items-center gap-1.5">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            side === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
          }`}
        >
          {side}
        </span>
        <span className="text-white font-medium">{asset}</span>
      </div>

      {/* Size */}
      <div className="col-span-1 text-gray-300">${size.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>

      {/* Leverage */}
      <div className="col-span-1 text-gray-400">{leverage}x</div>

      {/* Entry */}
      <div className="col-span-1 text-gray-300">${entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>

      {/* Current */}
      <div className="col-span-1 text-gray-300">${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>

      {/* PnL */}
      <div className={`col-span-1 font-medium ${pnlClass(pnl)}`}>
        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
        <span className="opacity-60 ml-1">({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
      </div>

      {/* Health Factor */}
      <div className={`col-span-1 font-medium ${hfClass(healthFactor)}`}>
        {healthFactor.toFixed(2)}
        <span className="text-gray-600 ml-1 font-normal">
          (liq ${liquidationPrice.toFixed(2)})
        </span>
      </div>

      {/* Collateral + Actions */}
      <div className="col-span-1 flex items-center justify-between">
        <span className="text-gray-400">${collateralAmount.toFixed(0)}</span>
        {onClose && (
          <button
            onClick={() => onClose(position)}
            className="px-2 py-1 rounded text-[10px] text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}
