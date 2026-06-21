# LevPilot

**Risk-guarded agentic leverage trading terminal on Sui.**

LevPilot lets you open leveraged long/short DeFi positions using plain-English chat commands. Behind the scenes, an AI agent parses your intent, evaluates risk, enforces policy limits, and prepares a transaction — which you must explicitly approve before anything touches your wallet.

---

## Overview

```
User Chat → Intent Parser (Claude) → Market + Risk + Policy Engines
         → Execution Plan → User Approval → PTB Builder
         → Wallet Signature → Sui Network → Position Tracking
```

LevPilot integrates four on-chain protocols:

| Protocol | Role |
|---|---|
| **DeepBook v3** | Order book DEX for spot swaps |
| **Scallop** | Lending protocol for collateral deposits and borrowing |
| **Pyth Oracle** | Real-time price feeds with confidence intervals |
| **Walrus** | Decentralized storage for position data |

---

## Features

- **Natural language trading** — type `"long SUI 3x with $500"` and the agent figures out the rest
- **AI-powered intent parsing** — Claude Haiku extracts structured trade parameters from freeform input and asks for clarification when needed
- **Multi-factor risk scoring** — composite 0–100 score based on volatility (Pyth confidence), leverage, and estimated slippage
- **Policy enforcement** — hard limits on leverage (≤ 5x), position size ($10k–$100k), and health factor (≥ 1.1) before any transaction is built
- **2-step approval flow** — plan is presented for review; wallet signature is only requested after explicit approval
- **On-chain execution via PTBs** — Sui Programmable Transaction Blocks, signed client-side; server never holds private keys
- **Position tracking** — open positions tracked with Scallop obligation IDs, P&L updated on demand

---

## Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript (ESM)
- **Framework**: Express.js
- **AI**: Anthropic SDK — Claude Haiku (`claude-haiku-4-5-20251001`)
- **Blockchain**: `@mysten/sui` v1.21, DeepBook v3, Scallop, Pyth, Walrus
- **Validation**: Zod

### Frontend
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS 4
- **State**: Zustand 5, TanStack React Query 5
- **Routing**: React Router DOM 7
- **Wallet**: `@mysten/dapp-kit` (Sui wallet adapter)
- **Charts**: lightweight-charts 5

### Monorepo
- Turbo — `/client`, `/server`, `/shared`

---

## Project Structure

```
levPilot/
├── client/                  # React frontend
│   └── src/
│       ├── app/             # App root, store, router
│       ├── components/      # chat/, trade/, rescue/, common/
│       ├── hooks/           # useAgent, useWallet, ...
│       └── pages/           # Dashboard, Home, History
│
├── server/                  # Express backend
│   └── src/
│       ├── agent/           # Orchestrator, intent parser, tool registry
│       ├── engines/
│       │   ├── market/      # Pyth + DeepBook + Scallop market data
│       │   ├── policy/      # Trade limit enforcement
│       │   └── risk/        # Composite risk scoring
│       ├── planner/         # Transaction strategies (long, short, exit)
│       ├── execution/       # PTB builder, Sui tx submission, position store
│       ├── routes/          # REST API routes
│       ├── types/           # Shared TypeScript types
│       └── config/          # Environment config (Zod-validated)
│
└── shared/                  # Shared types between client and server
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/agent/chat` | Send a message; returns plan or clarification |
| `POST` | `/agent/approve` | Approve a pending plan |
| `POST` | `/agent/reject` | Reject a pending plan |
| `GET` | `/agent/plan/:planId` | Poll plan status |
| `POST` | `/trade/build-ptb` | Convert approved plan to unsigned TX bytes |
| `POST` | `/trade/confirm` | Submit signed transaction to chain |
| `GET` | `/positions/:id` | Fetch open positions |
| `POST` | `/positions/monitor` | Trigger P&L update for open positions |

Rate limit: 5 requests/minute on `/agent/chat`.

---

## Risk Scoring

Each trade is scored 0–100 before execution:

| Component | Max Points | Source |
|---|---|---|
| Volatility | 40 | Pyth confidence interval |
| Leverage | 40 | User-specified multiplier |
| Slippage | 20 | DeepBook order book depth |

Grades: **A** (0–20) · **B** (21–40) · **C** (41–60) · **D** (61–80) · **F** (81–100)

Trades with `healthFactorAfter < 1.1` or policy violations are blocked before a plan is generated.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- A Sui-compatible wallet (Slush, Sui Wallet, etc.)
- Anthropic API key

### Installation

```bash
# Clone the repo
git clone https://github.com/your-org/levpilot.git
cd levpilot

# Install dependencies
npm install          # root
cd server && npm install
cd ../client && npm install
```

### Environment

Create a `.env` file in the project root:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Sui network (testnet | mainnet | devnet | localnet)
SUI_NETWORK=testnet
SUI_RPC_URL=                         # optional custom RPC

# DeepBook testnet (defaults pre-filled)
DEEPBOOK_PACKAGE_ID=0xfb28c4cbc6865bd1c897d26aecbe1f8792d1509a20ffec692c800660cbec6982
DEEPBOOK_REGISTRY_ID=0x7c256edbda983a2cd6f946655f4bf3f00a41043993781f8674a7046e8c0e11d1

# Scallop testnet (defaults pre-filled)
SCALLOP_PACKAGE_ID=0xd971609b7feb6230585831e7aeb3c121fb21b9431337a30fc99185eb459a05ee
SCALLOP_VERSION_ID=0x72bc09c4ce413d76d07f6e712413aebbe3ce3747eadfbc2331fbdb1dbde2d43a
SCALLOP_MARKET_ID=0xed80ed898df1e0b7a14b78c92527b47ef88591d5722ded16050d7e101687bb20

# Pyth testnet (default pre-filled)
PYTH_STATE_ID=0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c

# Walrus testnet (defaults pre-filled)
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

All contract addresses have testnet defaults — only `ANTHROPIC_API_KEY` is required to run.

### Development

```bash
# Start server (hot reload)
cd server && npm run dev

# Start client (in a separate terminal)
cd client && npm run dev
```

Server runs on `http://localhost:3001` · Client on `http://localhost:5173`

### Build

```bash
# Server
cd server && npm run build && npm start

# Client
cd client && npm run build
```

---

## Security Notes

- The server **never stores or transmits private keys**
- All transactions are built as unsigned PTB bytes and signed exclusively in the user's wallet
- Plan expiry: pending plans expire after 5 minutes if not approved
- Wallet authentication middleware available for request signing verification

---

## Supported Assets

`SUI` · `BTC` · `USDC` · `USDT`

---

## License

MIT
