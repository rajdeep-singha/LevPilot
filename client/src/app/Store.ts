import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Position } from '../types/position'
import type { ExecutionPlan, ChatMessage } from '../types/trade'

interface WalletState {
  address: string | null
  connected: boolean
  setAddress: (address: string | null) => void
  disconnect: () => void
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      connected: false,
      setAddress: (address) => set({ address, connected: !!address }),
      disconnect: () => set({ address: null, connected: false }),
    }),
    { name: 'levpilot-wallet' },
  ),
)

interface AgentState {
  messages: ChatMessage[]
  pendingPlan: ExecutionPlan | null
  isThinking: boolean
  addMessage: (msg: ChatMessage) => void
  setPendingPlan: (plan: ExecutionPlan | null) => void
  setThinking: (v: boolean) => void
  clearChat: () => void
}

export const useAgentStore = create<AgentState>((set) => ({
  messages: [],
  pendingPlan: null,
  isThinking: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setPendingPlan: (plan) => set({ pendingPlan: plan }),
  setThinking: (v) => set({ isThinking: v }),
  clearChat: () => set({ messages: [], pendingPlan: null }),
}))

interface PositionsState {
  positions: Position[]
  loading: boolean
  setPositions: (positions: Position[]) => void
  setLoading: (v: boolean) => void
}

export const usePositionsStore = create<PositionsState>((set) => ({
  positions: [],
  loading: false,
  setPositions: (positions) => set({ positions }),
  setLoading: (v) => set({ loading: v }),
}))

interface UIState {
  selectedAsset: string
  setSelectedAsset: (asset: string) => void
  tradePanel: 'chat' | 'confirm' | 'result'
  setTradePanel: (panel: 'chat' | 'confirm' | 'result') => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedAsset: 'SUI',
  setSelectedAsset: (asset) => set({ selectedAsset: asset }),
  tradePanel: 'chat',
  setTradePanel: (panel) => set({ tradePanel: panel }),
}))
