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
import { Series, ISeries } from '../models/Series.js';
import { Lesson } from '../models/Lesson.js';
import { Subscription } from '../models/Subscription.js';
import { GenerationJob } from '../models/GenerationJob.js';
import {
  createSeriesDetails,
  generateLesson,
  generateParable,
  generatePoem,
  generateImagePrompt,
  LessonOutput,
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
  const lessonOutput = await generateLesson(
    { title: series.title, anchor: series.anchor, description: series.description, theme: series.theme },
    null,
    []
  );

  // Generate parable (initializes characters)
  const parable = await generateParable(lessonOutput, series.characters || []);

  // Save characters to series
  await Series.findByIdAndUpdate(series._id, { characters: parable.characters });

  // Generate poem + image
  const poem = await generatePoem(lessonOutput);
  const imagePromptResult = await generateImagePrompt(poem);
  let imageUrl: string | undefined;
  try {
    imageUrl = await generateAndUploadImage(imagePromptResult.prompt, series.key, 1);
  } catch (err) {
    console.error('Image generation failed:', err);
  }

  // Save Lesson
  await Lesson.create({
    seriesId: series._id,
    sortOrder: 1,
    title: lessonOutput.title,
    content: lessonOutput.content,
    followUpQuestion: lessonOutput.followUpQuestion,
    date: new Date(),
    image: imageUrl,
    parable: parable.content,
    poem: `# ${poem.title}\n\n${poem.content}`,
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

    const lessonOutput = await generateLesson(
      { title: series.title, anchor: series.anchor, description: series.description, theme: series.theme },
      prevFollowUpQuestion,
      prevLessonData
    );

    const parable = await generateParable(lessonOutput, series.characters || []);

    // Merge new characters
    const existingNames = new Set(series.characters.map(c => c.name));
    const newChars = parable.characters.filter(c => !existingNames.has(c.name));
    if (newChars.length > 0) {
      await Series.findByIdAndUpdate(series._id, {
        $push: { characters: { $each: newChars } },
      });
    }

    const poem = await generatePoem(lessonOutput);
    const imagePromptResult = await generateImagePrompt(poem);
    let imageUrl: string | undefined;
    try {
      imageUrl = await generateAndUploadImage(imagePromptResult.prompt, series.key, nextSortOrder);
    } catch (err) {
      console.error('Image generation failed:', err);
    }

    await Lesson.create({
      seriesId: series._id,
      sortOrder: nextSortOrder,
      title: lessonOutput.title,
      content: lessonOutput.content,
      followUpQuestion: lessonOutput.followUpQuestion,
      date: new Date(),
      image: imageUrl,
      parable: parable.content,
      poem: `# ${poem.title}\n\n${poem.content}`,
    });
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
    theme: details.theme,
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

// ─── LessonOutput helper (used in AI tools) ────────────────────────────────────
export type { LessonOutput };
