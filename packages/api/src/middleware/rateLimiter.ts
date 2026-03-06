/**
 * Rate limiting middleware.
 *
 * Exports:
 * - `generalLimiter` — 100 req/min/IP, applied to all /api routes
 * - `authLimiter` — 10 req/min/IP, applied to all /auth routes
 * - `checkCreateSeriesLimit` — in-memory per-user limit: max 3 series creations per 24h.
 *   Not persisted across server restarts.
 */
import rateLimit from 'express-rate-limit';
import { Request } from 'express';

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || 'unknown',
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || 'unknown',
});

// Per-user rate limiter store: userId -> timestamps
const createSeriesStore = new Map<string, number[]>();

export function checkCreateSeriesLimit(userId: string): boolean {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const timestamps = (createSeriesStore.get(userId) || []).filter(t => t > oneDayAgo);
  if (timestamps.length >= 3) return false;
  timestamps.push(now);
  createSeriesStore.set(userId, timestamps);
  return true;
}
