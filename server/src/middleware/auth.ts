import type { Request, Response, NextFunction } from 'express';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';

// Extends Express Request with optional wallet address
declare global {
  namespace Express {
    interface Request {
      walletAddress?: string;
    }
  }
}

// ── Challenge store ────────────────────────────────────────────────────────
// In-memory nonce map: nonce → { walletAddress, expiresAt }
// Clients must request a challenge, sign it, and verify within 2 minutes.

interface Challenge {
  nonce: string;
  expiresAt: number;
}

const challenges = new Map<string, Challenge>();
const CHALLENGE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/** Generate a random hex nonce */
function generateNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Clean up expired challenges (called on each new challenge request) */
function pruneExpiredChallenges(): void {
  const now = Date.now();
  for (const [key, c] of challenges.entries()) {
    if (c.expiresAt < now) challenges.delete(key);
  }
}

// ── Exported route handlers ────────────────────────────────────────────────

/**
 * POST /auth/challenge
 * Returns a nonce the client should sign with their Sui wallet.
 * Body: { walletAddress: string }
 */
export function handleAuthChallenge(req: Request, res: Response): void {
  const { walletAddress } = req.body as { walletAddress?: string };
  if (typeof walletAddress !== 'string' || !walletAddress.startsWith('0x')) {
    res.status(400).json({ error: 'walletAddress required (must start with 0x)' });
    return;
  }

  pruneExpiredChallenges();
  const nonce = generateNonce();
  challenges.set(nonce, { nonce, expiresAt: Date.now() + CHALLENGE_TTL_MS });

  res.json({
    nonce,
    message: authMessage(walletAddress, nonce),
    expiresIn: CHALLENGE_TTL_MS,
  });
}

/**
 * POST /auth/verify
 * Verifies a signed challenge and attaches the wallet address to the session.
 * Body: { walletAddress: string; nonce: string; signature: string }
 *
 * The client should sign `authMessage(walletAddress, nonce)` with their wallet's
 * `signPersonalMessage` method and send the resulting signature here.
 */
export async function handleAuthVerify(req: Request, res: Response): Promise<void> {
  const { walletAddress, nonce, signature } = req.body as {
    walletAddress?: string;
    nonce?: string;
    signature?: string;
  };

  if (!walletAddress || !nonce || !signature) {
    res.status(400).json({ error: 'walletAddress, nonce and signature are required' });
    return;
  }

  const challenge = challenges.get(nonce);
  if (!challenge) {
    res.status(401).json({ error: 'Unknown or expired nonce — request a new challenge' });
    return;
  }
  if (challenge.expiresAt < Date.now()) {
    challenges.delete(nonce);
    res.status(401).json({ error: 'Challenge expired — request a new one' });
    return;
  }

  try {
    const message = authMessage(walletAddress, nonce);
    const messageBytes = new TextEncoder().encode(message);

    // verifyPersonalMessageSignature returns the public key if valid, throws if not
    const publicKey = await verifyPersonalMessageSignature(messageBytes, signature);
    const derivedAddress = publicKey.toSuiAddress();

    if (derivedAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      res.status(401).json({ error: 'Signature does not match wallet address' });
      return;
    }

    // Consume the nonce (one-time use)
    challenges.delete(nonce);

    res.json({ verified: true, walletAddress: derivedAddress });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(401).json({ error: `Signature verification failed: ${msg}` });
  }
}

// ── Request middleware ─────────────────────────────────────────────────────

/**
 * Reads wallet address from the x-wallet-address header (no signature required).
 * For sensitive operations (trade execution), the /trade routes rely on the
 * transaction signature itself as proof-of-ownership. The auth challenge flow
 * above is available for UI session establishment.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const addr = req.headers['x-wallet-address'];
  if (typeof addr === 'string' && addr.startsWith('0x')) {
    req.walletAddress = addr;
  }
  next();
}

/** The exact message string clients must sign for auth */
export function authMessage(walletAddress: string, nonce: string): string {
  return `levpilot:auth:${walletAddress}:${nonce}`;
}
