export type TradeAction = 'LONG' | 'SHORT' | 'EXIT' | 'REDUCE' | 'ADD_COLLATERAL' | 'REPAY';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
// ETH has no DeepBook v3 pool on testnet — omitted until mainnet
export type AssetSymbol = 'SUI' | 'BTC' | 'USDC' | 'USDT';

export interface TradeIntent {
  action: TradeAction;
  asset: AssetSymbol;
  collateral: AssetSymbol;   // asset being deposited as collateral
  capital: number;           // USD amount of user's own capital
  leverage: number;          // multiplier, e.g. 2 for 2x
  risk: RiskLevel;
  rawMessage: string;
  timestamp: number;
  positionId?: string;       // required for EXIT/REDUCE — links to the Position being closed
}

export interface IntentParseResult {
  success: boolean;
  intent?: TradeIntent;
  clarification?: string;  // ask user when message is ambiguous
  error?: string;
}
