/**
 * Authentication Middleware for Express
 */

import { Request, Response, NextFunction } from 'express';
import { SessionStore } from './session';

// Extend Express Request to include session
declare global {
  namespace Express {
    interface Request {
      session?: {
        userId: number;
        linkedExchanges: string[];
        activeExchange: string;
        createdAt: number;
        expiresAt: number;
      };
    }
  }
}

/**
 * Express middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Get session token from header or cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || req.cookies?.session;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: No session token provided' });
    return;
  }

  // Validate session
  const session = SessionStore.get(token);
  
  if (!session) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    return;
  }

  // Attach session to request
  req.session = session;

  next();
}

/**
 * Wrapper for async route handlers with authentication
 */
export function withAuth(handler: (req: Request, res: Response) => Promise<any>) {
  return async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.cookies?.session;

    if (!token) {
      res.status(401).json({ error: 'Unauthorized: No session token provided' });
      return;
    }

    const session = SessionStore.get(token);
    
    if (!session) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
      return;
    }

    req.session = session;

    try {
      await handler(req, res);
    } catch (error: any) {
      console.error('[API Error]', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

