import { Clock, ArrowUpRight } from 'lucide-react'
import { usePositionsStore } from '../app/Store'
import { suiExplorerTx } from '../lib/sui/ptb'

export default function History() {
  const positions = usePositionsStore((s) => s.positions)
  const closed = positions.filter((p) => p.status !== 'OPEN')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Clock size={20} className="text-emerald-400" />
          <h1 className="text-lg font-semibold">Trade History</h1>
        </div>

        {closed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Clock size={32} className="text-gray-700" />
            <p className="text-sm text-gray-500">No closed positions yet</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  {['Asset', 'Side', 'Size', 'Entry', 'PnL', 'Status', 'Opened', 'Tx'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closed.map((p) => (
                  <tr key={p.id} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                    <td className="px-4 py-3 font-medium text-white">{p.asset}</td>
                    <td className="px-4 py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.side === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                        {p.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">${p.size.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300">${p.entryPrice.toFixed(4)}</td>
                    <td className={`px-4 py-3 font-medium ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{p.status}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(p.openedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {p.planId && (
                        <a href={suiExplorerTx(p.planId)} target="_blank" rel="noopener noreferrer"
                          className="text-emerald-500 hover:text-emerald-400 flex items-center gap-0.5">
                          <ArrowUpRight size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
