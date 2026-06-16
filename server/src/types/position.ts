export type PositionSide = 'LONG' | 'SHORT';
export type PositionStatus = 'OPEN' | 'CLOSED' | 'LIQUIDATED' | 'REDUCING';

export interface Position {
  id: string;
  walletAddress: string;
  side: PositionSide;
  asset: string;
  collateralAsset: string;
  collateralAmount: number;    // USD
  borrowedAmount: number;      // USD
  entryPrice: number;          // USD
  currentPrice: number;        // USD
  leverage: number;
  size: number;                // total position size USD
  pnl: number;                 // unrealized PnL USD
  pnlPct: number;
  healthFactor: number;        // Scallop health factor
  liquidationPrice: number;    // USD price that triggers liquidation
  openedAt: number;            // unix ms
  updatedAt: number;
  status: PositionStatus;
  scallopObligationId?: string;
  deepbookOrderId?: string;
  planId?: string;             // links back to the ExecutionPlan that opened this
}
