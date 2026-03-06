/**
 * Progress model — tracks how far a user has advanced through a series.
 *
 * Fields:
 * - userId: ObjectId → User (required)
 * - seriesId: ObjectId → Series (required)
 * - currentDay: Number (default 1) — the lesson sortOrder the user is currently on
 *
 * Index: (userId, seriesId) unique
 *
 * Created automatically when a user subscribes (day 1) or when the 7AM cron
 * finds a subscription without progress. Advanced by PATCH /progress/advance
 * or by the 7AM cron when the current lesson has a Read record.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProgress extends Document {
  seriesId: Types.ObjectId;
  userId: Types.ObjectId;
  currentDay: number;
}

const ProgressSchema = new Schema<IProgress>({
  seriesId: { type: Schema.Types.ObjectId, ref: 'Series', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  currentDay: { type: Number, default: 1 },
});

ProgressSchema.index({ userId: 1, seriesId: 1 }, { unique: true });

export const Progress = mongoose.model<IProgress>('Progress', ProgressSchema);
