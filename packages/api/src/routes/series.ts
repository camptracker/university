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
import jwt from 'jsonwebtoken';
import { Series } from '../models/Series.js';
import { Lesson } from '../models/Lesson.js';
import { Subscription } from '../models/Subscription.js';
import { GenerationJob } from '../models/GenerationJob.js';
import { requireAuth, requireAdmin, type AuthPayload } from '../middleware/auth.js';
import { checkCreateSeriesLimit } from '../middleware/rateLimiter.js';
import { createSeriesWithFirstLesson, createLessonForSeries } from '../services/generationService.js';
import { streamLesson, generateLessonMeta } from '../services/aiTools.js';
import { generateAndUploadImage } from '../services/imageService.js';

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

// GET /api/series/demo-stream — pick a random lesson and mock-stream it via SSE (admin only)
router.get('/demo-stream', async (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
  } catch {
    res.status(401).json({ error: 'Invalid token' }); return;
  }
  if (payload.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }

  const count = await Lesson.countDocuments({ deletedAt: { $exists: false }, content: { $exists: true, $ne: '' }, parable: { $exists: true, $ne: '' } });
  if (!count) { res.status(404).json({ error: 'No lessons found' }); return; }
  const skip = Math.floor(Math.random() * count);
  const lesson = await Lesson.findOne({ deletedAt: { $exists: false }, content: { $exists: true, $ne: '' }, parable: { $exists: true, $ne: '' } }).skip(skip);
  if (!lesson) { res.status(404).json({ error: 'No lessons found' }); return; }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const streamWords = (section: string, text: string): Promise<void> => {
    return new Promise((resolve) => {
      const words = text.split(/(\s+)/);
      let i = 0;
      const iv = setInterval(() => {
        const chunk = words.slice(i, i + 3).join('');
        if (chunk) send('delta', { section, text: chunk });
        i += 3;
        if (i >= words.length) { clearInterval(iv); resolve(); }
      }, 50);
    });
  };

  send('phase', { phase: 'parable' });
  await streamWords('parable', lesson.parable!);

  send('phase', { phase: 'standard' });
  await streamWords('standard', lesson.content!);

  send('phase', { phase: 'image' });
  await new Promise(r => setTimeout(r, 500));

  send('done', { image: lesson.image || null });
  res.end();
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

// GET /api/series/:seriesId/generate-stream - SSE streaming lesson generation (admin)
router.get('/:seriesId/generate-stream', async (req: Request, res: Response) => {
  // Auth via query param (EventSource can't set headers)
  const token = req.query.token as string;
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
  } catch {
    res.status(401).json({ error: 'Invalid token' }); return;
  }
  if (payload.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }

  const { seriesId } = req.params;
  const series = await Series.findOne({ _id: seriesId, deletedAt: { $exists: false } });
  if (!series) { res.status(404).json({ error: 'Series not found' }); return; }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  const send = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Create job
  await GenerationJob.findOneAndUpdate(
    { seriesId },
    { status: 'generating', action: 'create', startedAt: new Date(), createdAt: new Date() },
    { upsert: true }
  );

  let clientDisconnected = false;
  req.on('close', () => {
    clientDisconnected = true;
    // Don't abort generation — let it finish and save to DB
  });

  try {
    // Load previous lessons
    const prevLessons = await Lesson.find({ seriesId, deletedAt: { $exists: false } }).sort({ sortOrder: 1 });
    const prevLessonData = prevLessons.map(l => ({ title: l.title, followUpQuestion: l.followUpQuestion }));
    const lastLesson = prevLessons[prevLessons.length - 1];
    const nextSortOrder = (lastLesson?.sortOrder || 0) + 1;

    const formatChars = (chars: { name: string; pronoun: string; role?: string }[]) =>
      chars.length === 0 ? 'None yet — create new characters.' : chars.map(c => `${c.name} (${c.pronoun}, ${c.role || 'character'})`).join(', ');

    const safeSend = (event: string, data: object) => {
      if (!clientDisconnected) send(event, data);
    };

    // Single streaming call: title, parable, then standard lesson
    safeSend('phase', { phase: 'title' });
    const { title: lessonTitle, parable: parableContent, standard: standardContent } = await streamLesson({
      seriesName: series.title,
      seriesTheme: series.theme,
      parableCharacters: formatChars(series.characters || []),
      newDay: nextSortOrder,
      tomorrowQuestion: lastLesson?.followUpQuestion || undefined,
      prevLessons: prevLessonData,
    }, {
      onTitleDelta: (text) => safeSend('delta', { section: 'title', text }),
      onParableDelta: (text) => safeSend('delta', { section: 'parable', text }),
      onStandardDelta: (text) => safeSend('delta', { section: 'standard', text }),
      onSectionSwitch: (toSection) => {
        safeSend('phase', { phase: toSection });
      },
    });

    // Phase 3: Generate metadata (non-streaming, fast)
    safeSend('phase', { phase: 'meta' });
    const meta = await generateLessonMeta({
      standardContent,
      parableContent,
      seriesName: series.title,
      newDay: nextSortOrder,
      existingCharacters: series.characters || [],
    });

    // Phase 4: Generate image
    safeSend('phase', { phase: 'image' });
    let imageUrl: string | undefined;
    try {
      imageUrl = await generateAndUploadImage(meta.dallePrompt, series.key, nextSortOrder);
    } catch (err) {
      console.error('Image generation failed:', err);
    }

    // Save lesson
    const lesson = await Lesson.create({
      seriesId: series._id,
      sortOrder: nextSortOrder,
      title: lessonTitle,
      content: standardContent,
      followUpQuestion: meta.followUpQuestion,
      date: new Date(),
      image: imageUrl,
      parable: parableContent,
      poem: meta.sonnet,
    });

    // Merge new characters
    const existingNames = new Set(series.characters.map(c => c.name));
    const newChars = meta.characters.filter(c => !existingNames.has(c.name));
    if (newChars.length > 0) {
      await Series.findByIdAndUpdate(series._id, { $push: { characters: { $each: newChars } } });
    }

    // Cleanup + done
    await GenerationJob.deleteOne({ seriesId });
    safeSend('done', { lessonId: String(lesson._id), image: imageUrl || null });
    if (!clientDisconnected) res.end();
  } catch (err) {
    console.error('SSE generation error:', err);
    const msg = err instanceof Error ? err.message : 'Generation failed';
    if (!clientDisconnected) {
      send('error', { message: msg });
      res.end();
    }
    await GenerationJob.deleteOne({ seriesId });
  }
});

// POST /api/series/:seriesId/generate - trigger next lesson generation (admin, fallback)
router.post('/:seriesId/generate', requireAdmin, async (req: Request, res: Response) => {
  const { seriesId } = req.params;

  const series = await Series.findOne({ _id: seriesId, deletedAt: { $exists: false } });
  if (!series) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  createLessonForSeries(seriesId as string).catch(console.error);
  res.json({ ok: true, message: 'Generation started' });
});

// GET /api/series/:seriesId/generation-status
router.get('/:seriesId/generation-status', async (req: Request, res: Response) => {
  const { seriesId } = req.params;
  // Auto-clean stale jobs older than 10 minutes
  await GenerationJob.deleteMany({ seriesId, createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } });
  const job = await GenerationJob.findOne({ seriesId });
  res.json({ generating: !!job });
});

// DELETE /api/series/:seriesId/generation - clear stuck generation job (admin)
router.delete('/:seriesId/generation', requireAdmin, async (req: Request, res: Response) => {
  const { seriesId } = req.params;
  await GenerationJob.deleteMany({ seriesId });
  res.json({ ok: true });
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

  // Clean up subscriptions, jobs
  await Subscription.deleteMany({ seriesId });
  await GenerationJob.deleteOne({ seriesId });

  res.json({ ok: true });
});

export default router;
