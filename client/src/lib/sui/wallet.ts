// Sui wallet utilities — wraps window.suiWallet (Sui Wallet extension)
// Falls back to manual address mode when no extension is detected.

export function isSuiWalletAvailable(): boolean {
  return typeof window !== 'undefined' && 'suiWallet' in window
}

export async function connectSuiWallet(): Promise<string | null> {
  if (!isSuiWalletAvailable()) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wallet = (window as any).suiWallet
    await wallet.requestPermissions()
    const accounts: string[] = await wallet.getAccounts()
    return accounts[0] ?? null
  } catch {
    return null
  }
}

export async function signTransactionWithExtension(
  txBytes: string,
): Promise<{ signature: string } | null> {
  if (!isSuiWalletAvailable()) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wallet = (window as any).suiWallet
    const result = await wallet.signTransaction({
      transaction: { kind: 'bytes', data: txBytes },
    })
    return { signature: result.signature }
  } catch {
    return null
  }
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

export function isValidSuiAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{63,64}$/.test(address)
}
