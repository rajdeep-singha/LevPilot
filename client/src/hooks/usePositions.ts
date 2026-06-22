import { useEffect, useCallback } from 'react'
import { usePositionsStore, useWalletStore, useTradeHistoryStore } from '../app/Store'
import { getPositions, getAllPositions } from '../lib/api'

export function usePositions() {
  const { positions, loading, setPositions, setLoading } = usePositionsStore()
  const address = useWalletStore((s) => s.address)
  const mergePositions = useTradeHistoryStore((s) => s.mergePositions)

  const refresh = useCallback(async () => {
    if (!address) {
      setPositions([])
      return
    }
    setLoading(true)
    try {
      // Fetch open positions (for live dashboard display) and all positions (for history)
      const [openResult, allResult] = await Promise.allSettled([
        getPositions(address),
        getAllPositions(address),
      ])

      if (openResult.status === 'fulfilled') {
        setPositions(openResult.value)
      }

      // Merge all server-side positions into the persistent history store.
      // This also includes the open ones so their prices stay current.
      if (allResult.status === 'fulfilled' && allResult.value.length > 0) {
        mergePositions(address, allResult.value)
      } else if (openResult.status === 'fulfilled' && openResult.value.length > 0) {
        // Fall back to merging just the open positions if /all fails
        mergePositions(address, openResult.value)
      }
    } catch {
      // silently ignore — server may not have positions yet
    } finally {
      setLoading(false)
    }
  }, [address, setPositions, setLoading, mergePositions])

  // Poll every 15 seconds while wallet is connected
  useEffect(() => {
    refresh()
    if (!address) return
    const id = setInterval(refresh, 15_000)
    return () => clearInterval(id)
  }, [address, refresh])

  return { positions, loading, refresh }
}
