import { registerTool } from '../../agent/toolRegistry.js';
import type { RiskEngineFunc } from '../../agent/toolRegistry.js';
import type { RiskReport, RiskGrade } from '../../types/risk.js';
import { fetchPriceWithConf } from '../market/oracle.js';
import { estimateSlippage } from '../market/deepbook.js';
import { getScallopMarket } from '../market/scallop.js';
import { computeVolatilityScore, volatilityLabel } from './volatility.js';
import {
  calculateHealthFactor,
  calculateLiquidationPrice,
  liquidationBuffer,
} from './healthFactor.js';
import type { AssetSymbol } from '../../config/sui.js';

const riskEngine: RiskEngineFunc = async (intent) => {
  const side = intent.action === 'SHORT' ? 'SHORT' : 'LONG';
  const borrowedUsd = intent.capital * (intent.leverage - 1);
  const totalPositionUsd = intent.capital * intent.leverage;

  // Fetch all data in parallel
  const [priceData, scallop, slippageData] = await Promise.all([
    fetchPriceWithConf(intent.asset as AssetSymbol),
    getScallopMarket(),
    estimateSlippage(intent.collateral, intent.asset, totalPositionUsd),
  ]);

  const { price, conf } = priceData;
  const cf = scallop.collateralFactor[intent.collateral] ?? 0.80;
  const borrowAPY = scallop.borrowAPY[intent.asset] ?? 5.0;

  // ── Scoring components ─────────────────────────────────────────────────
  // Volatility score: 0–40 (from Pyth confidence interval)
  const volScore = computeVolatilityScore(conf, price);

  // Leverage score: 0–40 (each lever adds ~10 pts)
  const leverageScore = Math.min(40, (intent.leverage - 1) * 10);

  // Slippage score: 0–20 (each 1% slippage adds 10 pts)
  const slippageScore = Math.min(20, slippageData.slippagePct * 10);

  // Composite risk score: 0–100
  const riskScore = Math.round(Math.min(100, volScore + leverageScore + slippageScore));
  const riskGrade = scoreToGrade(riskScore);

  // ── Health factor ──────────────────────────────────────────────────────
  const healthFactorAfter = calculateHealthFactor({
    collateralAmountUsd: intent.capital,
    collateralFactor: cf,
    borrowedAmountUsd: borrowedUsd,
  });

  // ── Liquidation buffer ─────────────────────────────────────────────────
  const liqPrice = calculateLiquidationPrice(price, intent.leverage, side);
  const buffer = liquidationBuffer(price, liqPrice, side);

  // ── Warnings ───────────────────────────────────────────────────────────
  const warnings: string[] = [];

  if (intent.leverage >= 4)
    warnings.push(`${intent.leverage}x leverage — liquidation risk is elevated`);

  if (slippageData.slippagePct > 1)
    warnings.push(`High slippage ~${slippageData.slippagePct.toFixed(2)}% — consider reducing size`);

  if (buffer < 15)
    warnings.push(`Only ${buffer.toFixed(1)}% buffer to liquidation price ($${liqPrice.toFixed(2)})`);

  if (borrowAPY > 10)
    warnings.push(`High borrow APY ${borrowAPY.toFixed(1)}% — holding costs are significant`);

  const volLabel = volatilityLabel(volScore);
  if (volLabel === 'High' || volLabel === 'Extreme')
    warnings.push(`${intent.asset} volatility is ${volLabel.toLowerCase()} right now`);

  const report: RiskReport = {
    riskScore,
    riskGrade,
    liquidationBuffer: buffer,
    estimatedSlippage: slippageData.slippagePct,
    borrowAPY,
    healthFactorAfter: isFinite(healthFactorAfter) ? healthFactorAfter : 999,
    warnings,
    safe: riskScore < 80 && healthFactorAfter >= 1.2 && buffer >= 10,
  };

  return report;
};

function scoreToGrade(score: number): RiskGrade {
  if (score < 20) return 'A';
  if (score < 40) return 'B';
  if (score < 60) return 'C';
  if (score < 80) return 'D';
  return 'F';
}

export function initRiskEngine(): void {
  registerTool('riskEngine', riskEngine);
  console.log('✅ Risk engine registered (Pyth volatility + health factor + slippage)');
}
