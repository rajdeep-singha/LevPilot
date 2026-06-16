export type TradeAction = 'LONG' | 'SHORT' | 'EXIT' | 'REDUCE' | 'ADD_COLLATERAL' | 'REPAY';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type AssetSymbol = 'SUI' | 'BTC' | 'ETH' | 'USDC' | 'USDT';

export interface TradeIntent {
  action: TradeAction;
  asset: AssetSymbol;
  collateral: AssetSymbol;   // asset being deposited as collateral
  capital: number;           // USD amount of user's own capital
  leverage: number;          // multiplier, e.g. 2 for 2x
  risk: RiskLevel;
  rawMessage: string;
  timestamp: number;
}

export interface IntentParseResult {
  success: boolean;
  intent?: TradeIntent;
  clarification?: string;  // ask user when message is ambiguous
  error?: string;
}
