import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { agentRouter } from './routes/agent.js';
import { errorHandler } from './middleware/errorHandler.js';
import { chatRateLimit } from './middleware/rateLimit.js';
import { optionalAuth } from './middleware/auth.js';

const app = express();

// ── Global middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '1mb' }));
app.use(optionalAuth);

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', network: env.SUI_NETWORK, ts: Date.now() });
});

// ── Feature routes ─────────────────────────────────────────────────────────
app.use('/agent', chatRateLimit, agentRouter);

// ── Error handler (must be last) ───────────────────────────────────────────
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀 LevPilot server on :${env.PORT} [${env.SUI_NETWORK}]`);
});
