import Anthropic from '@anthropic-ai/sdk';
import type {
  TradeIntent,
  IntentParseResult,
  AssetSymbol,
  TradeAction,
  RiskLevel,
} from '../types/intent.js';

const client = new Anthropic();

// Claude tool definition for structured intent extraction
const EXTRACT_INTENT_TOOL: Anthropic.Tool = {
  name: 'extract_trade_intent',
  description: 'Extract structured trading intent from a user message',
  input_schema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['LONG', 'SHORT', 'EXIT', 'REDUCE', 'ADD_COLLATERAL', 'REPAY'],
        description: 'The trading action the user wants to perform',
      },
      asset: {
        type: 'string',
        enum: ['SUI', 'BTC', 'ETH', 'USDC', 'USDT'],
        description: 'The asset to trade',
      },
      collateral: {
        type: 'string',
        enum: ['SUI', 'BTC', 'ETH', 'USDC', 'USDT'],
        description: 'Collateral asset to deposit — defaults to USDC',
      },
      capital: {
        type: 'number',
        description: 'Capital amount in USD (e.g. "$500" → 500)',
      },
      leverage: {
        type: 'number',
        description: 'Leverage multiplier, e.g. 2 for 2x. Default 1 if not specified.',
      },
      risk: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        description: 'Risk tolerance. Default MEDIUM.',
      },
      needsClarification: {
        type: 'boolean',
        description: 'True when the message is too ambiguous to act on',
      },
      clarificationMessage: {
        type: 'string',
        description: 'Question to ask the user when needsClarification is true',
      },
    },
    required: ['action', 'asset', 'capital', 'leverage', 'risk', 'needsClarification'],
  },
};

const SYSTEM_PROMPT = `You are the intent parser for LevPilot, a DeFi leverage trading agent on Sui (testnet).

The platform lets users open leveraged LONG / SHORT trades using:
  - DeepBook for spot + margin liquidity
  - Scallop for lending / borrowing / flash loans
  - Supported assets: SUI, BTC, ETH  (collateral: USDC or USDT)

Your job: extract structured intent from the user's message.

Rules:
  • "2x long" → action=LONG, leverage=2
  • "low-risk" → risk=LOW ; "high risk" / "degen" → risk=HIGH ; default=MEDIUM
  • No collateral mentioned → collateral=USDC
  • Parse capital as USD number: "$500" → 500, "500 USDC" → 500
  • If capital, asset, or action is missing / ambiguous → needsClarification=true
  • EXIT / REDUCE intents don't need capital — set capital=0

Examples:
  "Open a low-risk 2x SUI long using $500"   → LONG, SUI, 500, 2, LOW
  "3x short ETH with $1000"                  → SHORT, ETH, 1000, 3, MEDIUM
  "Close my position"                         → EXIT, capital=0, needsClarification=true (which asset?)
  "I want to bet on SUI going up"             → needsClarification (no capital)`;

interface RawToolInput {
  action: TradeAction;
  asset: AssetSymbol;
  collateral?: AssetSymbol;
  capital: number;
  leverage: number;
  risk: RiskLevel;
  needsClarification: boolean;
  clarificationMessage?: string;
}

export async function parseIntent(userMessage: string): Promise<IntentParseResult> {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [EXTRACT_INTENT_TOOL],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return { success: false, error: 'No structured intent returned by model' };
    }

    const input = toolUse.input as RawToolInput;

    if (input.needsClarification) {
      return {
        success: false,
        clarification:
          input.clarificationMessage ??
          'Could you provide more details? (e.g. asset, capital amount, leverage)',
      };
    }

    const intent: TradeIntent = {
      action: input.action,
      asset: input.asset,
      collateral: input.collateral ?? 'USDC',
      capital: input.capital,
      leverage: input.leverage ?? 1,
      risk: input.risk ?? 'MEDIUM',
      rawMessage: userMessage,
      timestamp: Date.now(),
    };

    return { success: true, intent };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Intent parsing failed: ${msg}` };
  }
}
