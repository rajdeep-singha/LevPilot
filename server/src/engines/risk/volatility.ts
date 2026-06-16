/**
 * Pyth provides a confidence interval (conf) alongside each price.
 * conf / price gives the relative uncertainty — a real-time volatility proxy
 * that requires no historical data.
 *
 * Typical values:
 *   SUI  ≈ 0.1–0.5%  → low-medium vol
 *   BTC  ≈ 0.05–0.2% → low vol
 *   ETH  ≈ 0.1–0.3%  → low-medium vol
 *   Spikes > 1% indicate high market uncertainty
 */

/** Maps Pyth confidence interval to a 0–40 risk score contribution */
export function computeVolatilityScore(conf: number, price: number): number {
  if (price <= 0) return 20; // unknown — use moderate score

  const relativeConf = conf / price; // e.g. 0.003 = 0.3%

  // Scale to 0–40:
  //   < 0.1%  → 0–5   (very stable)
  //   0.1–0.5% → 5–20  (normal)
  //   0.5–1%  → 20–35 (elevated)
  //   > 1%    → 35–40 (extreme)
  const score = Math.min(40, relativeConf * 4000);
  return parseFloat(score.toFixed(1));
}

/** Human-readable volatility label */
export function volatilityLabel(score: number): string {
  if (score < 8)  return 'Very Low';
  if (score < 16) return 'Low';
  if (score < 24) return 'Medium';
  if (score < 32) return 'High';
  return 'Extreme';
}
