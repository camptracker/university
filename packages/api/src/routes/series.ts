/**
 * Series routes — mounted at /api/series
 *
 * Routes:
 * - GET    /api/series                      — all active series, sorted by subscriberCount desc
 * - GET    /api/series/popular              — top 20 by subscriberCount
 * - POST   /api/series                      — create series from {topic}; auth required; 3/user/day limit
 *   Triggers async first-lesson generation; returns series immediately (no lesson yet)
 * - POST   /api/series/:seriesId/generate   — trigger next lesson generation; admin only
 * - GET    /api/series/:seriesId/generation-status — returns {generating: boolean}
 * - DELETE /api/series/:seriesId            — soft-delete series + lessons; admin only
 *   Also hard-deletes standards, subscriptions, and the active GenerationJob
 *
 * Dependencies: generationService (createSeriesWithFirstLesson, createLessonForSeries),
 * rateLimiter (checkCreateSeriesLimit), auth middleware
 */
import { Router, Request, Response } from 'express';
import { Series } from '../models/Series.js';
import { Lesson } from '../models/Lesson.js';
import { Standard } from '../models/Standard.js';
import { Subscription } from '../models/Subscription.js';
import { GenerationJob } from '../models/GenerationJob.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { checkCreateSeriesLimit } from '../middleware/rateLimiter.js';
import { createSeriesWithFirstLesson, createLessonForSeries } from '../services/generationService.js';

const router = Router();

// GET /api/series - all active series
router.get('/', async (_req: Request, res: Response) => {
  const seriesList = await Series.find({ deletedAt: { $exists: false } }).sort({ subscriberCount: -1 });
  res.json(seriesList);
});

// GET /api/series/popular - top 20 by subscriberCount
router.get('/popular', async (_req: Request, res: Response) => {
  const seriesList = await Series.find({ deletedAt: { $exists: false } })
    .sort({ subscriberCount: -1 })
    .limit(20);
  res.json(seriesList);
});

// POST /api/series - create new series (auth, rate 3/user/day)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.authUser!.userId;

  if (!checkCreateSeriesLimit(userId)) {
    res.status(429).json({ error: 'Rate limit: max 3 series per day' });
    return;
  }

  const { topic } = req.body;
  if (!topic || typeof topic !== 'string') {
    res.status(400).json({ error: 'topic is required' });
    return;
  }

  try {
    const series = await createSeriesWithFirstLesson(topic, userId);
    res.status(201).json(series);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    res.status(500).json({ error: msg });
  }
});

// POST /api/series/:seriesId/generate - trigger next lesson generation (admin)
router.post('/:seriesId/generate', requireAdmin, async (req: Request, res: Response) => {
  const { seriesId } = req.params;

  const series = await Series.findOne({ _id: seriesId, deletedAt: { $exists: false } });
  if (!series) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  const existing = await GenerationJob.findOne({ seriesId });
  if (existing) {
    res.status(409).json({ error: 'Generation already in progress' });
    return;
  }

  createLessonForSeries(seriesId as string).catch(console.error);
  res.json({ ok: true, message: 'Generation started' });
});

// GET /api/series/:seriesId/generation-status
router.get('/:seriesId/generation-status', async (req: Request, res: Response) => {
  const { seriesId } = req.params;
  const job = await GenerationJob.findOne({ seriesId });
  res.json({ generating: !!job });
});

// DELETE /api/series/:seriesId - soft delete + cleanup (admin)
router.delete('/:seriesId', requireAdmin, async (req: Request, res: Response) => {
  const { seriesId } = req.params;

  const series = await Series.findById(seriesId);
  if (!series) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  // Soft delete series
  series.deletedAt = new Date();
  await series.save();

  // Soft delete all lessons
  await Lesson.updateMany({ seriesId }, { deletedAt: new Date() });

  // Clean up standards, subscriptions, jobs
  const lessonIds = (await Lesson.find({ seriesId }, '_id')).map(l => l._id);
  await Standard.deleteMany({ lessonId: { $in: lessonIds } });
  await Subscription.deleteMany({ seriesId });
  await GenerationJob.deleteOne({ seriesId });

  res.json({ ok: true });
});

export default router;
