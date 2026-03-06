/**
 * Standard model — structured educational content for a lesson (1:1 with Lesson).
 *
 * Fields:
 * - lessonId: ObjectId → Lesson (required, unique)
 * - seriesId: ObjectId → Series (required, indexed)
 * - review: String? — brief recap of the previous lesson's concept; absent on lesson 1
 * - concept: String (required) — what is being taught in this lesson
 * - whyItMatters: String (required)
 * - howItWorks: String (required)
 * - definitions: IDefinition[] — [{term, definition}] key vocabulary
 * - wisdom: String (required) — the key takeaway (labeled by series.wisdomLabel in UI)
 * - followUpQuestion: String (required) — seeds the topic for the next lesson's generation
 *
 * Indexes: lessonId unique; seriesId
 * Relationships: belongs to Lesson; belongs to Series
 */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDefinition {
  term: string;
  definition: string;
}

export interface IStandard extends Document {
  lessonId: Types.ObjectId;
  seriesId: Types.ObjectId;
  review?: string;
  concept: string;
  whyItMatters: string;
  howItWorks: string;
  definitions: IDefinition[];
  wisdom: string;
  followUpQuestion: string;
}

const DefinitionSchema = new Schema<IDefinition>({
  term: { type: String, required: true },
  definition: { type: String, required: true },
}, { _id: false });

const StandardSchema = new Schema<IStandard>({
  lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, unique: true },
  seriesId: { type: Schema.Types.ObjectId, ref: 'Series', required: true, index: true },
  review: String,
  concept: { type: String, required: true },
  whyItMatters: { type: String, required: true },
  howItWorks: { type: String, required: true },
  definitions: [DefinitionSchema],
  wisdom: { type: String, required: true },
  followUpQuestion: { type: String, required: true },
});

StandardSchema.index({ lessonId: 1 }, { unique: true });
StandardSchema.index({ seriesId: 1 });

export const Standard = mongoose.model<IStandard>('Standard', StandardSchema);
