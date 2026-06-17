// PTB (Programmable Transaction Block) client-side helpers

export function formatMist(mist: string | number): string {
  const n = typeof mist === 'string' ? BigInt(mist) : BigInt(Math.floor(mist))
  const sui = Number(n) / 1e9
  return `${sui.toFixed(4)} SUI`
}

export function suiExplorerTx(digest: string, network = 'testnet'): string {
  return `https://suiscan.xyz/${network}/tx/${digest}`
}

export function suiExplorerObject(objectId: string, network = 'testnet'): string {
  return `https://suiscan.xyz/${network}/object/${objectId}`
}
