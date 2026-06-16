import type { Request, Response, NextFunction } from 'express';

// Extends Express Request with optional wallet address
declare global {
  namespace Express {
    interface Request {
      walletAddress?: string;
    }
  }
}

/**
 * Reads wallet address from the x-wallet-address header.
 * Full signature verification (ed25519 against a challenge) will be added
 * once the client wallet adapter is wired up.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const addr = req.headers['x-wallet-address'];
  if (typeof addr === 'string' && addr.startsWith('0x')) {
    req.walletAddress = addr;
  }
  next();
}
