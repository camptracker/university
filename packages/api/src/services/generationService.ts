/**
 * Generation service — orchestrates the full AI content generation pipeline.
 *
 * Exports:
 * - `createSeriesWithFirstLesson(topic, userId)` — creates a new Series, subscribes user,
 *   and fires first-lesson generation in the background. Returns series immediately.
 *   If the generated key already exists, subscribes user to existing series instead.
 *
 * - `createFirstLessonForSeries(series)` — generates lesson 1 without job queue:
 *   generateLesson (null prev) → generateParable (saves characters) → generatePoem →
 *   generateImagePrompt → DALL-E/Cloudinary → create Lesson
 *
 * - `createLessonForSeries(seriesId)` — generates the next lesson using the job queue:
 *   acquireJob → load prev lessons → generateLesson → generateParable
 *   (merge new characters) → generatePoem → image → create Lesson → releaseJob
 *   Called by the midnight cron and admin POST /api/series/:id/generate.
 *
 * Internal:
 * - `acquireJob(seriesId)` — creates a 'generating' job or returns false if busy
 * - `releaseJob(seriesId)` — deletes job or re-triggers if status was 'queued'
 *
 * Dependencies: aiTools (Claude), imageService (DALL-E/Cloudinary), all models
 */
import { randomUUID } from 'crypto';
import { Series, ISeries } from '../models/Series.js';
import { Lesson } from '../models/Lesson.js';
import { Subscription } from '../models/Subscription.js';
import { GenerationJob } from '../models/GenerationJob.js';
import {
  createSeriesDetails,
  generateFullLesson,
  FullLessonOutput,
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

function formatCharacters(characters: { name: string; pronoun: string; role?: string }[]): string {
  if (characters.length === 0) return 'None yet — create new characters for this series.';
  return characters.map(c => `${c.name} (${c.pronoun}, ${c.role || 'character'})`).join(', ');
}

export async function createFirstLessonForSeries(series: ISeries): Promise<void> {
  const result = await generateFullLesson({
    seriesName: series.title,
    seriesTheme: series.theme,
    parableCharacters: formatCharacters(series.characters || []),
    newDay: 1,
    tomorrowQuestion: undefined,
    prevLessons: [],
    existingCharacters: series.characters || [],
  });

  // Save characters to series
  await Series.findByIdAndUpdate(series._id, { characters: result.characters });

  // Generate image
  let imageUrl: string | undefined;
  try {
    imageUrl = await generateAndUploadImage(result.dallePrompt, series.key, 1);
  } catch (err) {
    console.error('Image generation failed:', err);
  }

  // Save Lesson
  await Lesson.create({
    seriesId: series._id,
    sortOrder: 1,
    title: result.title,
    content: result.standard,
    followUpQuestion: result.followUpQuestion,
    date: new Date(),
    image: imageUrl,
    parable: result.parable,
    poem: result.sonnet,
  });
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

    // Load all previous lessons
    const prevLessons = await Lesson.find({ seriesId, deletedAt: { $exists: false } }).sort({ sortOrder: 1 });

    const prevLessonData = prevLessons.map(l => ({
      title: l.title,
      followUpQuestion: l.followUpQuestion,
    }));

    const lastLesson = prevLessons[prevLessons.length - 1];
    const prevFollowUpQuestion = lastLesson?.followUpQuestion || '';
    const nextSortOrder = (lastLesson?.sortOrder || 0) + 1;

    const result = await generateFullLesson({
      seriesName: series.title,
      seriesTheme: series.theme,
      parableCharacters: formatCharacters(series.characters || []),
      newDay: nextSortOrder,
      tomorrowQuestion: prevFollowUpQuestion || undefined,
      prevLessons: prevLessonData,
      existingCharacters: series.characters || [],
    });

    // Merge new characters
    const existingNames = new Set(series.characters.map(c => c.name));
    const newChars = result.characters.filter(c => !existingNames.has(c.name));
    if (newChars.length > 0) {
      await Series.findByIdAndUpdate(series._id, {
        $push: { characters: { $each: newChars } },
      });
    }

    let imageUrl: string | undefined;
    try {
      imageUrl = await generateAndUploadImage(result.dallePrompt, series.key, nextSortOrder);
    } catch (err) {
      console.error('Image generation failed:', err);
    }

    await Lesson.create({
      seriesId: series._id,
      sortOrder: nextSortOrder,
      title: result.title,
      content: result.standard,
      followUpQuestion: result.followUpQuestion,
      date: new Date(),
      image: imageUrl,
      parable: result.parable,
      poem: result.sonnet,
    });
  } finally {
    await releaseJob(seriesId);
  }
}

// ─── Create Series ─────────────────────────────────────────────────────────────

export async function createSeriesWithFirstLesson(topic: string, userId: string): Promise<ISeries> {
  // Generate series details (title, description, anchor, theme)
  const details = await createSeriesDetails(topic);

  // Generate UUID for the series key
  const key = randomUUID();

  const series = await Series.create({
    title: details.title,
    key,
    description: details.description,
    anchor: details.anchor,
    theme: details.theme,
    characters: [],
    subscriberCount: 1,
    createdBy: userId,
  });

  // Subscribe creator
  await Subscription.create({ userId, seriesId: series._id });

  // First lesson is generated via SSE streaming when admin visits the series page

  return series;
}

// ─── FullLessonOutput helper ────────────────────────────────────────────────────
export type { FullLessonOutput };
