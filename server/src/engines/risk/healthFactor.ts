// Scallop health factor:
//   HF = Σ(collateral_i × LTV_i) / Σ(borrowed_j)
//   Liquidation triggers when HF < 1.0

export interface HealthFactorInputs {
  collateralAmountUsd: number;   // USD value of collateral being deposited
  collateralFactor: number;      // Scallop LTV for this collateral asset (e.g. 0.90 for USDC)
  borrowedAmountUsd: number;     // USD value of new borrow
  existingCollateralUsd?: number; // existing collateral already in the obligation
  existingBorrowedUsd?: number;   // existing debt already in the obligation
}

/**
 * Projects the health factor after a new deposit + borrow.
 * Returns Infinity when there is no debt (position is fully collateralised).
 */
export function calculateHealthFactor(inputs: HealthFactorInputs): number {
  const {
    collateralAmountUsd,
    collateralFactor,
    borrowedAmountUsd,
    existingCollateralUsd = 0,
    existingBorrowedUsd = 0,
  } = inputs;

  const totalWeightedCollateral =
    collateralAmountUsd * collateralFactor + existingCollateralUsd * collateralFactor;
  const totalBorrowed = borrowedAmountUsd + existingBorrowedUsd;

  if (totalBorrowed <= 0) return Infinity;
  return parseFloat((totalWeightedCollateral / totalBorrowed).toFixed(4));
}

/**
 * Estimates the price at which a leveraged position would be liquidated.
 * Uses a simplified maintenance margin model (5%).
 *
 * LONG:  liqPrice = entryPrice × (1 - 1/leverage + maintenanceMargin)
 * SHORT: liqPrice = entryPrice × (1 + 1/leverage - maintenanceMargin)
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: 'LONG' | 'SHORT',
  maintenanceMarginPct = 0.05,
): number {
  if (leverage <= 1) return 0; // no leverage = no liquidation

  const mm = maintenanceMarginPct;
  const liqPrice =
    side === 'LONG'
      ? entryPrice * (1 - 1 / leverage + mm)
      : entryPrice * (1 + 1 / leverage - mm);

  return parseFloat(Math.max(0, liqPrice).toFixed(6));
}

/**
 * Computes the % buffer between current price and the liquidation price.
 * A higher buffer = safer position.
 */
export function liquidationBuffer(
  currentPrice: number,
  liquidationPrice: number,
  side: 'LONG' | 'SHORT',
): number {
  if (liquidationPrice <= 0) return 100;
  const pct =
    side === 'LONG'
      ? ((currentPrice - liquidationPrice) / currentPrice) * 100
      : ((liquidationPrice - currentPrice) / currentPrice) * 100;
  return parseFloat(Math.max(0, pct).toFixed(2));
}
