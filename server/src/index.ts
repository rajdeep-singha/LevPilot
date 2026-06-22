import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
const __dotenvDir = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dotenvDir, '../../.env') });
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { agentRouter } from './routes/agent.js';
import { tradeRouter } from './routes/trade.js';
import { positionsRouter } from './routes/positions.js';
import { errorHandler } from './middleware/errorHandler.js';
import { chatRateLimit } from './middleware/rateLimit.js';
import { optionalAuth, handleAuthChallenge, handleAuthVerify } from './middleware/auth.js';
import { initPolicyEngine } from './engines/policy/policyEngine.js';
import { initMarketEngine } from './engines/market/marketEngine.js';
import { initRiskEngine } from './engines/risk/riskEngine.js';

const app = express();

// ── Global middleware ──────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow localhost for dev
    if (origin.startsWith('http://localhost')) return callback(null, true);
    // Allow all vercel.app deployments (covers preview URLs too)
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow custom CLIENT_URL if set
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) return callback(null, true);
    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(optionalAuth);

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', network: env.SUI_NETWORK, ts: Date.now() });
});

// ── Sui RPC proxy ──────────────────────────────────────────────────────────
// The Sui fullnode doesn't set CORS headers for arbitrary origins, so browser
// requests from lev-pilot.vercel.app are blocked. We proxy here — the server
// has no CORS restriction calling the fullnode, and our CORS middleware above
// already allows the Vercel frontend to call this server.
const SUI_FULLNODE = `https://fullnode.${env.SUI_NETWORK}.sui.io:443`;

app.post('/rpc', async (req, res, next) => {
  try {
    const upstream = await fetch(SUI_FULLNODE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    next(err);
  }
});

// ── Feature routes ─────────────────────────────────────────────────────────
app.post('/auth/challenge', handleAuthChallenge);
app.post('/auth/verify', handleAuthVerify);
app.use('/agent', chatRateLimit, agentRouter);
app.use('/trade', tradeRouter);
app.use('/positions', positionsRouter);

// ── Error handler (must be last) ───────────────────────────────────────────
app.use(errorHandler);

// ── Initialise engines (self-register into toolRegistry) ───────────────────
initPolicyEngine();
initMarketEngine();
initRiskEngine();

app.listen(env.PORT, () => {
  console.log(`🚀 LevPilot server on :${env.PORT} [${env.SUI_NETWORK}]`);
});
