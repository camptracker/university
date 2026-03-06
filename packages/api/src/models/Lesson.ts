/**
 * Lesson model — one day's content within a series.
 *
 * Fields:
 * - seriesId: ObjectId → Series (required, indexed)
 * - sortOrder: Number (required) — 1-based day number, unique per series
 * - title: String (required)
 * - content: String (required) — markdown lesson content
 * - followUpQuestion: String (required) — Socratic question seeding the next lesson
 * - date: Date (required) — generation date
 * - image: String? — Cloudinary URL (parable/{seriesKey}/day-{sortOrder})
 * - parable: String? — markdown narrative story
 * - poem: String? — markdown format: "# Title\n\n{haiku}"
 * - deletedAt: Date? — soft delete; filter with { deletedAt: { $exists: false } }
 * - createdAt: Date
 *
 * Indexes: (seriesId, sortOrder) unique; (seriesId, deletedAt)
 * Relationships: belongs to Series
 */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILesson extends Document {
  seriesId: Types.ObjectId;
  sortOrder: number;
  title: string;
  content: string;
  followUpQuestion: string;
  date: Date;
  image?: string;
  parable?: string;
  poem?: string;
  deletedAt?: Date;
  createdAt: Date;
}

const LessonSchema = new Schema<ILesson>({
  seriesId: { type: Schema.Types.ObjectId, ref: 'Series', required: true, index: true },
  sortOrder: { type: Number, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  followUpQuestion: { type: String, required: true },
  date: { type: Date, required: true },
  image: String,
  parable: String,
  poem: String,
  deletedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

LessonSchema.index({ seriesId: 1, sortOrder: 1 }, { unique: true });
LessonSchema.index({ seriesId: 1, deletedAt: 1 });

export const Lesson = mongoose.model<ILesson>('Lesson', LessonSchema);
