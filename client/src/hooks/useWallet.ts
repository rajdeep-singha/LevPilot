import { useCurrentAccount, useConnectWallet, useDisconnectWallet, useWallets } from '@mysten/dapp-kit'
import { useWalletStore } from '../app/Store'
import { shortenAddress } from '../lib/sui/wallet'

export function useWallet() {
  const currentAccount = useCurrentAccount()
  const { mutate: connectWallet } = useConnectWallet()
  const { mutate: disconnectWallet } = useDisconnectWallet()
  const wallets = useWallets()
  const { address: manualAddress, setAddress, disconnect: clearManual } = useWalletStore()

  // Prefer dapp-kit connected account, fall back to manually entered address
  const address = currentAccount?.address ?? manualAddress
  const connected = !!address

  const connectExtension = async (): Promise<boolean> => {
    const wallet = wallets[0]
    if (!wallet) return false
    return new Promise((resolve) => {
      connectWallet(
        { wallet },
        { onSuccess: () => resolve(true), onError: () => resolve(false) },
      )
    })
  }

  const connectManual = (addr: string): boolean => {
    if (/^0x[0-9a-fA-F]{63,64}$/.test(addr)) {
      setAddress(addr)
      return true
    }
    return false
  }

  const disconnect = () => {
    disconnectWallet()
    clearManual()
  }

  return {
    address,
    connected,
    short: address ? shortenAddress(address) : null,
    hasExtension: wallets.length > 0,
    connectExtension,
    connectManual,
    disconnect,
  }
}
