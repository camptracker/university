/**
 * Lesson model — one day's content within a series.
 *
 * Fields:
 * - seriesId: ObjectId → Series (required, indexed)
 * - sortOrder: Number (required) — 1-based day number, unique per series
 * - title: String (required)
 * - date: Date (required) — generation date
 * - image: String? — Cloudinary URL (parable/{seriesKey}/day-{sortOrder})
 * - standardId: ObjectId? → Standard — linked after Standard is created
 * - parable: String? — markdown narrative story
 * - sonnet: String? — markdown format: "# Title\n\n{14 lines}"
 * - deletedAt: Date? — soft delete; filter with { deletedAt: { $exists: false } }
 * - createdAt: Date
 *
 * Indexes: (seriesId, sortOrder) unique; (seriesId, deletedAt)
 * Relationships: belongs to Series; has one Standard
 */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILesson extends Document {
  seriesId: Types.ObjectId;
  sortOrder: number;
  title: string;
  date: Date;
  image?: string;
  standardId?: Types.ObjectId;
  parable?: string;
  sonnet?: string;
  deletedAt?: Date;
  createdAt: Date;
}

const LessonSchema = new Schema<ILesson>({
  seriesId: { type: Schema.Types.ObjectId, ref: 'Series', required: true, index: true },
  sortOrder: { type: Number, required: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
  image: String,
  standardId: { type: Schema.Types.ObjectId, ref: 'Standard' },
  parable: String,
  sonnet: String,
  deletedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

LessonSchema.index({ seriesId: 1, sortOrder: 1 }, { unique: true });
LessonSchema.index({ seriesId: 1, deletedAt: 1 });

export const Lesson = mongoose.model<ILesson>('Lesson', LessonSchema);
