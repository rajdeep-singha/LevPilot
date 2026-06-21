import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  History,
  LogOut,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type CandlestickSeriesOptions } from 'lightweight-charts'
import { ChatWindow } from '../components/chat/ChatWindow'
import { PositionCard } from '../components/trade/PositionCard'
import { AlertBanner } from '../components/rescue/AlertBanner'
import { Modal } from '../components/common/Modal'
import { Button } from '../components/common/Button'
import { Spinner } from '../components/common/Spinner'
import { useWallets, useConnectWallet } from '@mysten/dapp-kit'
import { useWallet } from '../hooks/useWallet'
import { usePositions } from '../hooks/usePositions'
import { useRescue } from '../hooks/useRescue'
import { useAgent } from '../hooks/useAgent'
import { getHealth } from '../lib/api'
import { isValidSuiAddress } from '../lib/sui/wallet'

// ── Mock price data generator ──────────────────────────────────────────────

const ASSET_BASE_PRICES: Record<string, number> = { SUI: 3.45, BTC: 67500, USDC: 1 }

function generateCandles(asset: string, count = 120): CandlestickData[] {
  let price = ASSET_BASE_PRICES[asset] ?? 3.45
  const now = Math.floor(Date.now() / 1000)
  const candles: CandlestickData[] = []
  for (let i = count; i >= 0; i--) {
    const volatility = asset === 'BTC' ? 0.008 : 0.015
    const change = (Math.random() - 0.48) * volatility * price
    const open = price
    const close = price + change
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5)
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5)
    candles.push({ time: (now - i * 300) as CandlestickData['time'], open, high, low, close })
    price = close
  }
  return candles
}

// ── Assets ─────────────────────────────────────────────────────────────────

const ASSETS = ['SUI', 'BTC', 'USDC']

// ── Wallet connect modal ───────────────────────────────────────────────────

function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const wallets = useWallets()
  const { mutate: connectWallet } = useConnectWallet()
  const { connectManual } = useWallet()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState<string | null>(null)

  function handleConnect(wallet: (typeof wallets)[number]) {
    setConnecting(wallet.name)
    connectWallet(
      { wallet },
      {
        onSuccess: () => { setConnecting(null); onClose() },
        onError: () => { setConnecting(null); setError(`Failed to connect ${wallet.name}. Make sure the extension is unlocked.`) },
      },
    )
  }

  function handleManual() {
    if (!isValidSuiAddress(input)) { setError('Enter a valid Sui address (0x…)'); return }
    connectManual(input)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect Wallet">
      <div className="space-y-4">

        {/* Detected wallet extensions */}
        {wallets.length > 0 ? (
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => handleConnect(wallet)}
                disabled={!!connecting}
                className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
              >
                <img src={wallet.icon} alt={wallet.name} className="w-7 h-7 rounded-lg" />
                <span className="text-sm text-white font-medium flex-1 text-left">{wallet.name}</span>
                {connecting === wallet.name && <Spinner size="sm" />}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-700 p-4 space-y-3 text-center">
            <p className="text-sm text-gray-400">No Sui wallet detected in your browser.</p>
            <div className="space-y-1.5">
              <a
                href="https://phantom.app/download"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                <span className="text-base">👻</span> Install Phantom <span className="text-xs opacity-60">↗</span>
              </a>
              <a
                href="https://suiwallet.com"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span className="text-base">🌊</span> Install Sui Wallet <span className="text-xs opacity-60">↗</span>
              </a>
            </div>
            <p className="text-[11px] text-gray-600">MetaMask does not support Sui network.</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-xs text-gray-500">or read-only mode</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        <input
          type="text"
          placeholder="0x… paste your Sui address"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError('') }}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button variant="outline" className="w-full" onClick={handleManual}>
          View-only (no signing)
        </Button>

      </div>
    </Modal>
  )
}

// ── Price Chart ─────────────────────────────────────────────────────────────

function PriceChart({ asset }: { asset: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#6b7280' },
      grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151', timeVisible: true },
      handleScale: true,
      handleScroll: true,
    })
    chartRef.current = chart

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    } as Partial<CandlestickSeriesOptions>)
    seriesRef.current = series

    const candles = generateCandles(asset)
    series.setData(candles)
    chart.timeScale().fitContent()

    // Simulate live ticks
    let lastCandle = candles[candles.length - 1]
    intervalRef.current = setInterval(() => {
      const volatility = asset === 'BTC' ? 0.003 : 0.006
      const close = lastCandle.close * (1 + (Math.random() - 0.48) * volatility)
      const high = Math.max(lastCandle.high, close)
      const low = Math.min(lastCandle.low, close)
      const updated = { ...lastCandle, close, high, low }
      series.update(updated)
      lastCandle = updated
    }, 2000)

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [asset])

  return <div ref={containerRef} className="w-full h-full" />
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { connected, short, disconnect } = useWallet()
  const { positions, loading: posLoading, refresh } = usePositions()
  const { alerts } = useRescue()
  const { sendMessage } = useAgent()

  const [selectedAsset, setSelectedAsset] = useState('SUI')
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [serverStatus, setServerStatus] = useState<'ok' | 'error' | 'checking'>('checking')
  const [livePrice, setLivePrice] = useState(ASSET_BASE_PRICES)
  const [positionsTab, setPositionsTab] = useState<'open' | 'history'>('open')

  // Server health check
  useEffect(() => {
    getHealth()
      .then(() => setServerStatus('ok'))
      .catch(() => setServerStatus('error'))
  }, [])

  // Simulate price ticker
  useEffect(() => {
    const id = setInterval(() => {
      setLivePrice((prev) => ({
        SUI: prev.SUI * (1 + (Math.random() - 0.49) * 0.004),
        BTC: prev.BTC * (1 + (Math.random() - 0.49) * 0.002),
        USDC: 1,
      }))
    }, 3000)
    return () => clearInterval(id)
  }, [])

  const handleClosePosition = useCallback(
    (position: { id: string; asset: string; side: string }) => {
      sendMessage(`exit my ${position.asset} ${position.side} position (id: ${position.id})`)
    },
    [sendMessage],
  )

  const openPositions = positions.filter((p) => p.status === 'OPEN')
  const closedPositions = positions.filter((p) => p.status !== 'OPEN')

  const currentPrice = livePrice[selectedAsset] ?? 0
  const priceChange = selectedAsset === 'BTC' ? 2.34 : selectedAsset === 'SUI' ? -1.12 : 0

  return (
    <div className="h-screen bg-[#0a0b0f] text-white flex flex-col overflow-hidden">
      {/* ── Top Nav ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm shrink-0">
        {/* Left: Logo + nav */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-black text-xs font-black">L</span>
            </div>
            <span className="text-sm font-bold text-white tracking-tight">LevPilot</span>
          </div>
          <nav className="hidden md:flex items-center gap-4">
            {['Trade', 'Positions', 'History'].map((item) => (
              <button
                key={item}
                onClick={() => item === 'History' && navigate('/app/history')}
                className={`text-xs font-medium transition-colors ${item === 'Trade' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        {/* Center: Asset price ticker */}
        <div className="hidden lg:flex items-center gap-6">
          {ASSETS.filter((a) => a !== 'USDC').map((asset) => {
            const price = livePrice[asset] ?? 0
            const change = asset === 'BTC' ? 2.34 : -1.12
            return (
              <button
                key={asset}
                onClick={() => setSelectedAsset(asset)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${selectedAsset === asset ? 'bg-gray-800' : 'hover:bg-gray-800/50'}`}
              >
                <span className="text-xs font-medium text-gray-400">{asset}/USDC</span>
                <span className="text-xs font-semibold text-white">
                  ${price.toLocaleString(undefined, { maximumFractionDigits: asset === 'BTC' ? 0 : 4 })}
                </span>
                <span className={`text-[10px] font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </span>
              </button>
            )
          })}
        </div>

        {/* Right: Status + wallet */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {serverStatus === 'ok' ? (
              <CheckCircle2 size={12} className="text-emerald-400" />
            ) : serverStatus === 'error' ? (
              <AlertCircle size={12} className="text-red-400" />
            ) : (
              <Spinner size="sm" />
            )}
            <span className="text-[10px] text-gray-500 hidden sm:block">
              {serverStatus === 'ok' ? 'Testnet' : serverStatus === 'error' ? 'Server offline' : 'Connecting…'}
            </span>
          </div>

          {connected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-gray-300 font-mono">{short}</span>
                <ChevronDown size={12} className="text-gray-500" />
              </div>
              <button onClick={disconnect} className="text-gray-600 hover:text-gray-400 transition-colors" title="Disconnect">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setWalletModalOpen(true)}>
              <Wallet size={13} />
              Connect Wallet
            </Button>
          )}
        </div>
      </header>

      {/* ── Alerts ───────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-800/60 shrink-0">
          <AlertBanner alerts={alerts} />
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chart + positions (center) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Asset selector + price header */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-800/60 shrink-0 bg-gray-950/40">
            <div className="flex gap-1">
              {ASSETS.map((a) => (
                <button
                  key={a}
                  onClick={() => setSelectedAsset(a)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    selectedAsset === a
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 ml-2">
              <span className="text-lg font-bold text-white">
                ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: selectedAsset === 'BTC' ? 0 : 4 })}
              </span>
              <span className={`flex items-center gap-0.5 text-xs font-medium ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}% 24h
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={refresh} className="text-gray-600 hover:text-gray-400 transition-colors" title="Refresh positions">
                <RefreshCw size={13} className={posLoading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => navigate('/app/history')}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <History size={12} />
                History
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-0 p-2">
            <div className="w-full h-full rounded-xl overflow-hidden bg-gray-900/30 border border-gray-800/40">
              <PriceChart asset={selectedAsset} />
            </div>
          </div>

          {/* Positions panel */}
          <div className="h-52 border-t border-gray-800/60 flex flex-col shrink-0">
            <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800/40 shrink-0">
              <div className="flex gap-1">
                {(['open', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPositionsTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                      positionsTab === tab ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab === 'open' ? `Positions (${openPositions.length})` : `History (${closedPositions.length})`}
                  </button>
                ))}
              </div>
              {posLoading && <Spinner size="sm" className="ml-auto" />}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Table header */}
              {positionsTab === 'open' && (
                <>
                  <div className="grid grid-cols-8 gap-2 px-4 py-2 text-[10px] text-gray-600 uppercase tracking-wider border-b border-gray-800/40 sticky top-0 bg-gray-950">
                    {['Asset', 'Size', 'Lev', 'Entry', 'Current', 'PnL', 'Health', 'Collateral'].map((h) => (
                      <span key={h}>{h}</span>
                    ))}
                  </div>
                  {openPositions.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs text-gray-600">
                      {connected ? 'No open positions' : 'Connect wallet to see positions'}
                    </div>
                  ) : (
                    openPositions.map((p) => (
                      <PositionCard key={p.id} position={p} onClose={handleClosePosition} />
                    ))
                  )}
                </>
              )}

              {positionsTab === 'history' && (
                <>
                  {closedPositions.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs text-gray-600">No history yet</div>
                  ) : (
                    <div className="divide-y divide-gray-800/40">
                      {closedPositions.map((p) => (
                        <div key={p.id} className="flex items-center gap-4 px-4 py-2.5 text-xs">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${p.side === 'LONG' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{p.side}</span>
                          <span className="text-white">{p.asset}</span>
                          <span className="text-gray-400">{p.status}</span>
                          <span className={`font-medium ml-auto ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                          </span>
                          {p.planId && (
                            <a href={`https://suiscan.xyz/testnet/tx/${p.planId}`} target="_blank" rel="noopener noreferrer" className="text-emerald-500">
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Chat panel ─────────────────────────────────────────── */}
        <div className="w-[340px] xl:w-[380px] shrink-0 border-l border-gray-800/60 flex flex-col overflow-hidden">
          <ChatWindow />
        </div>
      </div>

      {/* Wallet modal */}
      <WalletModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  )
}
