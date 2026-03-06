/**
 * Lesson and progress routes — mounted at /api
 *
 * Routes:
 * - GET   /api/series/:seriesId/lessons             — paginated lessons (20/page); optional auth
 *   Returns {lessons, total, page, pages, progress}. Each lesson has dayNumber = sortOrder.
 *   progress is included if user is authenticated.
 * - GET   /api/lessons/:lessonId                    — single lesson with standard populated
 * - DELETE /api/lessons/:lessonId                   — soft delete; admin only
 * - GET   /api/series/:seriesId/progress            — lessons up to currentDay with read status; auth required
 * - PATCH /api/series/:seriesId/progress/advance    — mark current lesson read + advance; auth required
 *   Returns {currentDay, hasNext}. Advances only if next lesson exists.
 * - POST  /api/lessons/:lessonId/read               — upsert Read record; auth required
 *
 * Dependencies: Lesson, Standard, Progress, Read models; requireAuth, optionalAuth, requireAdmin
 */
import { Router, Request, Response } from 'express';
import { Lesson } from '../models/Lesson.js';
import { Standard } from '../models/Standard.js';
import { Progress } from '../models/Progress.js';
import { Read } from '../models/Read.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/series/:seriesId/lessons - paginate 20, compute dayNumber, include progress if authed
router.get('/series/:seriesId/lessons', optionalAuth, async (req: Request, res: Response) => {
  const { seriesId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const [lessons, total] = await Promise.all([
    Lesson.find({ seriesId, deletedAt: { $exists: false } })
      .sort({ sortOrder: 1 })
      .skip(skip)
      .limit(limit),
    Lesson.countDocuments({ seriesId, deletedAt: { $exists: false } }),
  ]);

  const lessonsWithDay = lessons.map(l => ({
    ...l.toObject(),
    dayNumber: l.sortOrder,
  }));

  let progress: { currentDay: number } | null = null;
  if (req.authUser) {
    const prog = await Progress.findOne({ userId: req.authUser.userId, seriesId });
    if (prog) progress = { currentDay: prog.currentDay };
  }

  res.json({ lessons: lessonsWithDay, total, page, pages: Math.ceil(total / limit), progress });
});

// GET /api/lessons/:lessonId - with standard populated
router.get('/lessons/:lessonId', async (req: Request, res: Response) => {
  try {
    const { lessonId } = req.params;
    if (!(lessonId as string).match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({ error: 'Invalid lesson ID' });
      return;
    }
    const lesson = await Lesson.findOne({ _id: lessonId, deletedAt: { $exists: false } });

    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    const standard = lesson.standardId
      ? await Standard.findById(lesson.standardId)
      : null;

    res.json({ ...lesson.toObject(), standard });
  } catch (err) {
    console.error('GET /lessons/:lessonId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/lessons/:lessonId - soft delete (admin)
router.delete('/lessons/:lessonId', requireAdmin, async (req: Request, res: Response) => {
  const { lessonId } = req.params;
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }
  lesson.deletedAt = new Date();
  await lesson.save();
  res.json({ ok: true });
});

// GET /api/series/:seriesId/progress - lessons up to currentDay + read status (auth)
router.get('/series/:seriesId/progress', requireAuth, async (req: Request, res: Response) => {
  const { seriesId } = req.params;
  const userId = req.authUser!.userId;

  const progress = await Progress.findOne({ userId, seriesId });
  const currentDay = progress?.currentDay ?? 1;

  const lessons = await Lesson.find({
    seriesId,
    deletedAt: { $exists: false },
    sortOrder: { $lte: currentDay },
  }).sort({ sortOrder: 1 });

  const lessonIds = lessons.map(l => String(l._id));
  const reads = await Read.find({ userId, lessonId: { $in: lessonIds } });
  const readSet = new Set(reads.map(r => String(r.lessonId)));

  const result = lessons.map(l => ({
    ...l.toObject(),
    dayNumber: l.sortOrder,
    read: readSet.has(String(l._id)),
  }));

  res.json({ lessons: result, progress: progress ? { currentDay } : null });
});

// PATCH /api/series/:seriesId/progress/advance - mark current day read, advance (auth)
router.patch('/series/:seriesId/progress/advance', requireAuth, async (req: Request, res: Response) => {
  const { seriesId } = req.params;
  const userId = req.authUser!.userId;

  const progress = await Progress.findOne({ userId, seriesId });
  if (!progress) {
    res.status(404).json({ error: 'No progress found' });
    return;
  }

  // Mark current day's lesson as read
  const currentLesson = await Lesson.findOne({
    seriesId,
    sortOrder: progress.currentDay,
    deletedAt: { $exists: false },
  });
  if (currentLesson) {
    await Read.findOneAndUpdate(
      { userId, lessonId: currentLesson._id },
      { readAt: new Date() },
      { upsert: true, new: true }
    );
  }

  // Check if next lesson exists
  const nextLesson = await Lesson.findOne({
    seriesId,
    sortOrder: progress.currentDay + 1,
    deletedAt: { $exists: false },
  });

  if (nextLesson) {
    progress.currentDay += 1;
    await progress.save();
  }

  res.json({ currentDay: progress.currentDay, hasNext: !!nextLesson });
});

// POST /api/lessons/:lessonId/read - mark as read, upsert (auth)
router.post('/lessons/:lessonId/read', requireAuth, async (req: Request, res: Response) => {
  const { lessonId } = req.params;
  const userId = req.authUser!.userId;

  const lesson = await Lesson.findOne({ _id: lessonId, deletedAt: { $exists: false } });
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }

  await Read.findOneAndUpdate(
    { userId, lessonId },
    { readAt: new Date() },
    { upsert: true, new: true }
  );

  res.json({ ok: true });
});

export default router;
