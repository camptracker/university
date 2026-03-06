/**
 * Scheduled cron jobs (node-cron, UTC timezone).
 *
 * Exports:
 * - `startOrchestrateSeriesCron` — runs at midnight UTC (0 0 * * *).
 *   Calls createLessonForSeries for every active series with concurrency=3.
 *   This is the primary mechanism for daily lesson production.
 *
 * - `startOrchestrateProgressCron` — runs at 7AM UTC (0 7 * * *).
 *   For each subscription: creates Progress at day 1 if missing, or advances
 *   currentDay if the user has a Read record for the current lesson.
 *
 * Both crons are started from src/index.ts on server boot (skipped in test env).
 */
import cron from 'node-cron';
import pLimit from 'p-limit';
import { Series } from '../models/Series.js';
import { Lesson } from '../models/Lesson.js';
import { Subscription } from '../models/Subscription.js';
import { Progress } from '../models/Progress.js';
import { Read } from '../models/Read.js';
import { createLessonForSeries } from '../services/generationService.js';

// Midnight: generate next lesson for all active series (concurrency 3)
export function startOrchestrateSeriesCron(): void {
  cron.schedule('0 0 * * *', async () => {
    console.log('[cron] orchestrateSeries starting...');
    try {
      const allSeries = await Series.find({ deletedAt: { $exists: false } });
      const limit = pLimit(3);
      await Promise.all(
        allSeries.map(s => limit(() => createLessonForSeries(String(s._id))))
      );
      console.log(`[cron] orchestrateSeries done: ${allSeries.length} series`);
    } catch (err) {
      console.error('[cron] orchestrateSeries error:', err);
    }
  }, { timezone: 'UTC' });
}

// 7AM: advance progress if user has read current lesson
export function startOrchestrateProgressCron(): void {
  cron.schedule('0 7 * * *', async () => {
    console.log('[cron] orchestrateProgress starting...');
    try {
      const subscriptions = await Subscription.find({});
      let advanced = 0;

      for (const sub of subscriptions) {
        const progress = await Progress.findOne({ userId: sub.userId, seriesId: sub.seriesId });

        if (!progress) {
          // Create initial progress at day 1
          await Progress.findOneAndUpdate(
            { userId: sub.userId, seriesId: sub.seriesId },
            { $setOnInsert: { userId: sub.userId, seriesId: sub.seriesId, currentDay: 1 } },
            { upsert: true }
          );
          advanced++;
          continue;
        }

        // Check if current day's lesson has been read
        const currentLesson = await Lesson.findOne({
          seriesId: sub.seriesId,
          sortOrder: progress.currentDay,
          deletedAt: { $exists: false },
        });
        if (!currentLesson) continue;

        const currentRead = await Read.findOne({ userId: sub.userId, lessonId: currentLesson._id });
        if (!currentRead) continue;

        // Find next lesson
        const nextLesson = await Lesson.findOne({
          seriesId: sub.seriesId,
          deletedAt: { $exists: false },
          sortOrder: progress.currentDay + 1,
        });

        if (nextLesson) {
          progress.currentDay += 1;
          await progress.save();
          advanced++;
        }
      }

      console.log(`[cron] orchestrateProgress done: advanced ${advanced} users`);
    } catch (err) {
      console.error('[cron] orchestrateProgress error:', err);
    }
  }, { timezone: 'UTC' });
}
