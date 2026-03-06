/**
 * Generation service — orchestrates the full AI content generation pipeline.
 *
 * Exports:
 * - `createSeriesWithFirstLesson(topic, userId)` — creates a new Series, subscribes user,
 *   and fires first-lesson generation in the background. Returns series immediately.
 *   If the generated key already exists, subscribes user to existing series instead.
 *
 * - `createFirstLessonForSeries(series)` — generates lesson 1 without job queue:
 *   generateFirstStandard → generateParable (saves characters) → generateSonnet →
 *   generateImagePrompt → DALL-E/Cloudinary → create Lesson + Standard
 *
 * - `createLessonForSeries(seriesId)` — generates the next lesson using the job queue:
 *   acquireJob → load prev lessons/standards → generateStandard → generateParable
 *   (merge new characters) → generateSonnet → image → create Lesson + Standard → releaseJob
 *   Called by the midnight cron and admin POST /api/series/:id/generate.
 *
 * Internal:
 * - `acquireJob(seriesId)` — creates a 'generating' job or returns false if busy
 * - `releaseJob(seriesId)` — deletes job or re-triggers if status was 'queued'
 *
 * Dependencies: aiTools (Claude), imageService (DALL-E/Cloudinary), all models
 */
import { Series, ISeries } from '../models/Series.js';
import { Lesson } from '../models/Lesson.js';
import { Standard } from '../models/Standard.js';
import { Subscription } from '../models/Subscription.js';
import { GenerationJob } from '../models/GenerationJob.js';
import {
  createSeriesDetails,
  generateFirstStandard,
  generateStandard,
  generateParable,
  generateSonnet,
  generateImagePrompt,
  StandardOutput,
} from './aiTools.js';
import { generateAndUploadImage } from './imageService.js';

// ─── Job Queue ────────────────────────────────────────────────────────────────

async function acquireJob(seriesId: string): Promise<boolean> {
  const existing = await GenerationJob.findOne({ seriesId });
  if (existing) {
    if (existing.status === 'generating') {
      // Already running — mark as queued
      existing.status = 'queued';
      await existing.save();
      return false;
    }
    if (existing.status === 'queued') {
      return false;
    }
  }

  await GenerationJob.findOneAndUpdate(
    { seriesId },
    { status: 'generating', action: 'create', startedAt: new Date(), createdAt: new Date() },
    { upsert: true }
  );
  return true;
}

async function releaseJob(seriesId: string): Promise<void> {
  const job = await GenerationJob.findOne({ seriesId });
  if (!job) return;

  if (job.status === 'queued') {
    // There's a pending request — rerun
    job.status = 'generating';
    job.startedAt = new Date();
    await job.save();
    // Fire off next generation in background
    createLessonForSeries(seriesId).catch(console.error);
  } else {
    await GenerationJob.deleteOne({ seriesId });
  }
}

// ─── Core Generation ──────────────────────────────────────────────────────────

export async function createFirstLessonForSeries(series: ISeries): Promise<void> {
  const standard = await generateFirstStandard(series.anchor, series.title, series.description);

  // Generate parable (initializes characters)
  const parable = await generateParable(standard, series.characters || []);

  // Save characters to series
  await Series.findByIdAndUpdate(series._id, { characters: parable.characters });

  // Generate sonnet + image
  const sonnet = await generateSonnet(standard);
  const imagePromptResult = await generateImagePrompt(sonnet);
  let imageUrl: string | undefined;
  try {
    imageUrl = await generateAndUploadImage(imagePromptResult.prompt, series.key, 1);
  } catch (err) {
    console.error('Image generation failed:', err);
  }

  // Save Standard + Lesson
  const lesson = await Lesson.create({
    seriesId: series._id,
    sortOrder: 1,
    title: standard.title,
    date: new Date(),
    image: imageUrl,
    parable: parable.content,
    sonnet: `# ${sonnet.title}\n\n${sonnet.content}`,
  });

  const savedStandard = await Standard.create({
    lessonId: lesson._id,
    seriesId: series._id,
    concept: standard.concept,
    whyItMatters: standard.whyItMatters,
    howItWorks: standard.howItWorks,
    definitions: standard.definitions,
    wisdom: standard.wisdom,
    followUpQuestion: standard.followUpQuestion,
  });

  lesson.standardId = savedStandard._id;
  await lesson.save();
}

export async function createLessonForSeries(seriesId: string): Promise<void> {
  const acquired = await acquireJob(seriesId);
  if (!acquired) return;

  try {
    const series = await Series.findById(seriesId);
    if (!series || series.deletedAt) {
      await releaseJob(seriesId);
      return;
    }

    // Load all previous lessons + standards
    const prevLessons = await Lesson.find({ seriesId, deletedAt: { $exists: false } }).sort({ sortOrder: 1 });
    const prevStandards = await Standard.find({ seriesId });

    const standardMap = new Map(prevStandards.map(s => [String(s.lessonId), s]));

    const prevLessonData = prevLessons.map(l => {
      const std = standardMap.get(String(l._id));
      return {
        title: l.title,
        followUpQuestion: std?.followUpQuestion || '',
      };
    });

    const lastLesson = prevLessons[prevLessons.length - 1];
    const lastStandard = lastLesson ? standardMap.get(String(lastLesson._id)) : null;
    const prevFollowUpQuestion = lastStandard?.followUpQuestion || '';

    const nextSortOrder = (lastLesson?.sortOrder || 0) + 1;

    const standard = await generateStandard(
      { title: series.title, anchor: series.anchor, description: series.description },
      prevFollowUpQuestion,
      prevLessonData
    );

    const parable = await generateParable(standard, series.characters || []);

    // Merge new characters
    const existingNames = new Set(series.characters.map(c => c.name));
    const newChars = parable.characters.filter(c => !existingNames.has(c.name));
    if (newChars.length > 0) {
      await Series.findByIdAndUpdate(series._id, {
        $push: { characters: { $each: newChars } },
      });
    }

    const sonnet = await generateSonnet(standard);
    const imagePromptResult = await generateImagePrompt(sonnet);
    let imageUrl: string | undefined;
    try {
      imageUrl = await generateAndUploadImage(imagePromptResult.prompt, series.key, nextSortOrder);
    } catch (err) {
      console.error('Image generation failed:', err);
    }

    const lesson = await Lesson.create({
      seriesId: series._id,
      sortOrder: nextSortOrder,
      title: standard.title,
      date: new Date(),
      image: imageUrl,
      parable: parable.content,
      sonnet: `# ${sonnet.title}\n\n${sonnet.content}`,
    });

    const savedStandard = await Standard.create({
      lessonId: lesson._id,
      seriesId: series._id,
      review: standard.review,
      concept: standard.concept,
      whyItMatters: standard.whyItMatters,
      howItWorks: standard.howItWorks,
      definitions: standard.definitions,
      wisdom: standard.wisdom,
      followUpQuestion: standard.followUpQuestion,
    });

    lesson.standardId = savedStandard._id;
    await lesson.save();
  } finally {
    await releaseJob(seriesId);
  }
}

// ─── Create Series ─────────────────────────────────────────────────────────────

export async function createSeriesWithFirstLesson(topic: string, userId: string): Promise<ISeries> {
  // Generate series details
  const details = await createSeriesDetails(topic);

  // Check if key already exists
  const existing = await Series.findOne({ key: details.key });
  if (existing) {
    // Subscribe user to existing series
    await Subscription.findOneAndUpdate(
      { userId, seriesId: existing._id },
      { userId, seriesId: existing._id },
      { upsert: true }
    );
    await Series.findByIdAndUpdate(existing._id, { $inc: { subscriberCount: 1 } });
    return existing;
  }

  const series = await Series.create({
    title: details.title,
    key: details.key,
    description: details.description,
    anchor: details.anchor,
    emoji: details.emoji,
    wisdomLabel: details.wisdomLabel,
    characters: [],
    subscriberCount: 1,
    createdBy: userId,
  });

  // Subscribe creator
  await Subscription.create({ userId, seriesId: series._id });

  // Generate first lesson in background
  createFirstLessonForSeries(series).catch(console.error);

  return series;
}

// ─── Standard Output helper (used in AI tools) ────────────────────────────────
export type { StandardOutput };
