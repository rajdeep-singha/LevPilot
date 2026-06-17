import { useCallback } from 'react'
import { useWalletStore } from '../app/Store'
import { isValidSuiAddress, shortenAddress, isSuiWalletAvailable, connectSuiWallet } from '../lib/sui/wallet'

export function useWallet() {
  const { address, connected, setAddress, disconnect } = useWalletStore()

  const connectManual = useCallback(
    (addr: string) => {
      if (isValidSuiAddress(addr)) {
        setAddress(addr)
        return true
      }
      return false
    },
    [setAddress],
  )

  const connectExtension = useCallback(async () => {
    if (!isSuiWalletAvailable()) return false
    const addr = await connectSuiWallet()
    if (addr) {
      setAddress(addr)
      return true
    }
    return false
  }, [setAddress])

  return {
    address,
    connected,
    short: address ? shortenAddress(address) : null,
    hasExtension: isSuiWalletAvailable(),
    connectManual,
    connectExtension,
    disconnect,
  }
}
