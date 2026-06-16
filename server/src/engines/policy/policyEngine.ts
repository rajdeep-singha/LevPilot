import { registerTool } from '../../agent/toolRegistry.js';
import type { PolicyCheckFunc } from '../../agent/toolRegistry.js';
import { getPolicyForUser } from './rules.js';

const policyCheck: PolicyCheckFunc = (intent, risk) => {
  // PolicyCheckFunc has no walletAddress param — use default policy
  // Per-wallet policy requires a future signature change
  const policy = getPolicyForUser();
  const violations: string[] = [];

  if (intent.leverage > policy.maxLeverage)
    violations.push(`Leverage ${intent.leverage}x exceeds maximum ${policy.maxLeverage}x`);

  if (!policy.allowedAssets.includes(intent.asset))
    violations.push(`Asset ${intent.asset} is not permitted`);

  if (intent.capital < policy.minPositionSizeUsd)
    violations.push(`Trade size $${intent.capital} is below the $${policy.minPositionSizeUsd} minimum`);

  if (intent.capital > policy.maxPositionSizeUsd)
    violations.push(`Trade size $${intent.capital} exceeds the $${policy.maxPositionSizeUsd} maximum`);

  if (risk.estimatedSlippage > policy.maxSlippagePercent)
    violations.push(
      `Estimated slippage ${risk.estimatedSlippage.toFixed(2)}% exceeds ${policy.maxSlippagePercent}% limit`,
    );

  if (risk.healthFactorAfter < policy.minHealthFactor)
    violations.push(
      `Projected health factor ${risk.healthFactorAfter.toFixed(2)} is below the ${policy.minHealthFactor} minimum`,
    );

  return { allowed: violations.length === 0, violations };
};

export function initPolicyEngine(): void {
  registerTool('policyCheck', policyCheck);
  console.log('✅ Policy engine registered');
}
