/**
 * GenerationJob model — distributed lock preventing concurrent AI generation per series.
 *
 * Fields:
 * - seriesId: ObjectId → Series (required, unique) — one job per series at a time
 * - status: 'generating' | 'queued'
 *   - 'generating': job is actively running
 *   - 'queued': another request arrived while generating; will re-run after current finishes
 * - action: 'create' | 'delete' — type of operation
 * - targetLessonId: ObjectId? → Lesson
 * - startedAt: Date?
 * - createdAt: Date — TTL indexed, auto-expires after 30 minutes (clears stuck jobs)
 *
 * See generationService.ts: acquireJob / releaseJob for the full queue pattern.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';

export type JobStatus = 'generating' | 'queued';
export type JobAction = 'create' | 'delete';

export interface IGenerationJob extends Document {
  seriesId: Types.ObjectId;
  status: JobStatus;
  action: JobAction;
  targetLessonId?: Types.ObjectId;
  startedAt?: Date;
  createdAt: Date;
}

const GenerationJobSchema = new Schema<IGenerationJob>({
  seriesId: { type: Schema.Types.ObjectId, ref: 'Series', required: true, unique: true },
  status: { type: String, enum: ['generating', 'queued'], required: true },
  action: { type: String, enum: ['create', 'delete'], required: true },
  targetLessonId: { type: Schema.Types.ObjectId, ref: 'Lesson' },
  startedAt: Date,
  createdAt: { type: Date, default: Date.now, expires: 1800 }, // TTL 30min
});

export const GenerationJob = mongoose.model<IGenerationJob>('GenerationJob', GenerationJobSchema);
