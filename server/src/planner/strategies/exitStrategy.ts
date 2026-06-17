import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import type { ExecutionPlan } from '../../types/plan.js';
import {
  resolveUserCoin,
  scallopRepay,
  scallopWithdrawCollateral,
  deepbookSwap,
  scallopVersionArg,
  clockArg,
  deepbookRegistryArg,
  GAS_BUDGET_MIST,
} from '../ptbBuilder.js';
import { getPoolId } from '../../engines/market/deepbook.js';
import { fetchPrice } from '../../engines/market/oracle.js';
import type { AssetSymbol } from '../../config/sui.js';

// Scallop shared Market object — verified from scallop-io/sui-scallop-sdk testAddress.ts (core.market)
const SCALLOP_MARKET_ID = '0xa7f41efe3b551c20ad6d6cea6ccd0fd68d2e2eaaacdca5e62d956209f6a51312';

export interface ObligationRefs {
  obligationId: string;    // shared Obligation object ID
  obligationKeyId: string; // owned ObligationKey NFT object ID
}

/**
 * Builds a PTB to fully exit a leveraged position:
 *
 * For a LONG exit:
 *   1. Sell the held asset back to USDC on DeepBook
 *   2. Repay USDC debt to Scallop
 *   3. Withdraw original USDC collateral from Scallop
 *
 * For a SHORT exit:
 *   1. Buy back the shorted asset with USDC on DeepBook
 *   2. Repay the borrowed asset to Scallop
 *   3. Withdraw original collateral from Scallop
 */
export async function buildExitPTB(
  plan: ExecutionPlan,
  walletAddress: string,
  positionSide: 'LONG' | 'SHORT' = 'LONG',
  obligation: ObligationRefs,
): Promise<Transaction> {
  const { intent } = plan;
  const tx = new Transaction();
  tx.setSender(walletAddress);
  tx.setGasBudget(GAS_BUDGET_MIST);

  const version = scallopVersionArg(tx);
  const clock = clockArg(tx);
  const registry = deepbookRegistryArg(tx);
  const marketObj = tx.object(SCALLOP_MARKET_ID);
  const obligationObj = tx.object(obligation.obligationId);
  const obligationKeyObj = tx.object(obligation.obligationKeyId);

  const assetPrice = await fetchPrice(intent.asset as AssetSymbol);
  const assetDecimals = 1e9;

  if (positionSide === 'LONG') {
    // Close LONG: sell asset → USDC → repay → withdraw collateral
    const poolId = getPoolId(intent.asset, 'USDC');
    if (!poolId || poolId === '0x') throw new Error(`No pool for ${intent.asset}/USDC`);

    const positionSizeUsd = intent.capital * intent.leverage;
    const assetUnitsToSell = BigInt(Math.floor((positionSizeUsd / assetPrice) * assetDecimals));
    const minUsdcOut = BigInt(Math.floor(positionSizeUsd * 0.95 * 1e6));

    const assetCoin = await resolveUserCoin(tx, walletAddress, intent.asset, assetUnitsToSell);

    // Step 1 — Sell asset → USDC
    const usdcFromSale = deepbookSwap(
      tx, poolId, assetCoin, intent.asset, 'USDC', minUsdcOut, false, clock, registry,
    );

    // Step 2 — Repay USDC debt to Scallop
    scallopRepay(tx, 'USDC', usdcFromSale, version, marketObj, obligationObj, clock);

    // Step 3 — Withdraw original collateral
    const collateralUnits = BigInt(Math.floor(intent.capital * 1e6));
    const collateralOut = scallopWithdrawCollateral(
      tx, intent.collateral, collateralUnits, version, marketObj,
      obligationObj, obligationKeyObj, clock,
    );
    tx.transferObjects([collateralOut as unknown as TransactionObjectArgument], walletAddress);

  } else {
    // Close SHORT: buy back asset → repay → withdraw collateral
    const poolId = getPoolId('USDC', intent.asset);
    if (!poolId || poolId === '0x') throw new Error(`No pool for USDC/${intent.asset}`);

    const positionSizeUsd = intent.capital * intent.leverage;
    const usdcToBuy = BigInt(Math.floor(positionSizeUsd * 1.05 * 1e6)); // 5% buffer
    const assetUnitsMin = BigInt(
      Math.floor((positionSizeUsd / assetPrice) * assetDecimals * 0.95),
    );

    const usdcCoin = await resolveUserCoin(tx, walletAddress, 'USDC', usdcToBuy);

    // Step 1 — Buy back the shorted asset
    const repurchasedAsset = deepbookSwap(
      tx, poolId, usdcCoin, intent.asset, 'USDC', assetUnitsMin, true, clock, registry,
    );

    // Step 2 — Repay the borrowed asset to Scallop
    scallopRepay(tx, intent.asset, repurchasedAsset, version, marketObj, obligationObj, clock);

    // Step 3 — Withdraw original USDC collateral
    const collateralUnits = BigInt(Math.floor(intent.capital * 1e6));
    const collateralOut = scallopWithdrawCollateral(
      tx, intent.collateral, collateralUnits, version, marketObj,
      obligationObj, obligationKeyObj, clock,
    );
    tx.transferObjects([collateralOut as unknown as TransactionObjectArgument], walletAddress);
  }

  return tx;
}
