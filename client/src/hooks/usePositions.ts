import { useEffect, useCallback } from 'react'
import { usePositionsStore, useWalletStore } from '../app/Store'
import { getPositions } from '../lib/api'

export function usePositions() {
  const { positions, loading, setPositions, setLoading } = usePositionsStore()
  const address = useWalletStore((s) => s.address)

  const refresh = useCallback(async () => {
    if (!address) {
      setPositions([])
      return
    }
    setLoading(true)
    try {
      const data = await getPositions(address)
      setPositions(data)
    } catch {
      // silently ignore — server may not have positions yet
    } finally {
      setLoading(false)
    }
  }, [address, setPositions, setLoading])

  // Poll every 15 seconds while wallet is connected
  useEffect(() => {
    refresh()
    if (!address) return
    const id = setInterval(refresh, 15_000)
    return () => clearInterval(id)
  }, [address, refresh])

  return { positions, loading, refresh }
}
