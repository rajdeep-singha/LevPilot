export type PositionSide = 'LONG' | 'SHORT'
export type PositionStatus = 'OPEN' | 'CLOSED' | 'LIQUIDATED' | 'REDUCING'

export interface Position {
  id: string
  walletAddress: string
  side: PositionSide
  asset: string
  collateralAsset: string
  collateralAmount: number
  borrowedAmount: number
  entryPrice: number
  currentPrice: number
  leverage: number
  size: number
  pnl: number
  pnlPct: number
  healthFactor: number
  liquidationPrice: number
  openedAt: number
  updatedAt: number
  status: PositionStatus
  scallopObligationId?: string
  scallopObligationKeyId?: string
  deepbookOrderId?: string
  planId?: string
}
