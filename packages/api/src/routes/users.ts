/**
 * User routes — mounted at /api/users
 *
 * Routes:
 * - GET   /api/users/me              — current user profile; auth required
 *   Excludes refreshToken and googleId fields.
 * - PATCH /api/users/:userId/role    — set user role to 'user' or 'admin'; admin only
 * - GET   /api/users                 — all users sorted by createdAt desc; admin only
 *   Excludes refreshToken and googleId.
 *
 * Dependencies: User model; requireAuth, requireAdmin middleware
 */
import { Router, Request, Response } from 'express';
import { User } from '../models/User.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/users/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await User.findById(req.authUser!.userId, '-refreshToken -googleId');
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

// PATCH /api/users/:userId/role (admin)
router.patch('/:userId/role', requireAdmin, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  const user = await User.findByIdAndUpdate(userId, { role }, { new: true, select: '-refreshToken -googleId' });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

// GET /api/users - list all users (admin)
router.get('/', requireAdmin, async (_req: Request, res: Response) => {
  const users = await User.find({}, '-refreshToken -googleId').sort({ createdAt: -1 });
  res.json(users);
});

export default router;
