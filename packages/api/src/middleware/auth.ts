/**
 * JWT authentication middleware and token utilities.
 *
 * Exports:
 * - `requireAuth` — rejects non-authenticated requests (sets req.authUser)
 * - `optionalAuth` — attaches req.authUser if token present, never rejects
 * - `requireAdmin` — like requireAuth but also checks role === 'admin'
 * - `generateTokens` — creates accessToken (15m) and refreshToken (30d) JWP pair
 * - `verifyRefreshToken` — validates token signature + DB stored token match
 * - `AuthPayload` interface — {userId, email, role}
 *
 * IMPORTANT: Uses `req.authUser` (not `req.user`) to avoid Passport namespace conflict.
 * `req.user` is reserved for Passport's OAuth callback and cast manually there.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.authUser = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      req.authUser = payload;
    } catch { /* ignore invalid tokens */ }
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.authUser?.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  });
}

export function generateTokens(userId: string, email: string, role: string) {
  const payload: AuthPayload = { userId, email, role };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(payload.userId);
    if (!user || user.refreshToken !== token) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
