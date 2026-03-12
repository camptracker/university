/**
 * Series model — a topic-based learning curriculum.
 *
 * Fields:
 * - title: String (required)
 * - key: String (required, unique) — URL slug, e.g. 'stoic-philosophy'
 * - description: String (required) — short summary
 * - anchor: String (required) — Socratic starter question that kicks off the learning journey
 * - theme: String (required) — overarching theme of the series
 * - characters: ICharacter[] — recurring narrative characters, merged across lessons
 * - subscriberCount: Number (default 0) — denormalized; incremented/decremented on subscribe
 * - deletedAt: Date? — soft delete; queries filter { deletedAt: { $exists: false } }
 * - createdBy: ObjectId? → User
 * - createdAt: Date
 *
 * Relationships: has many Lessons, Subscriptions, Progresses, GenerationJobs
 */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICharacterMemory {
  event: string;
  perspective: string;
  lessonNumber: number;
}

export interface ICharacter {
  name: string;
  pronoun: string;
  age?: string;
  personality?: string;
  role?: string;
  values?: string;
  memories?: ICharacterMemory[];
}

export interface ISeries extends Document {
  title: string;
  key: string;
  description: string;
  anchor: string;
  theme: string;
  characters: ICharacter[];
  subscriberCount: number;
  deletedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
}

const CharacterMemorySchema = new Schema<ICharacterMemory>({
  event: { type: String, required: true },
  perspective: { type: String, required: true },
  lessonNumber: { type: Number, required: true },
}, { _id: false });

const CharacterSchema = new Schema<ICharacter>({
  name: { type: String, required: true },
  pronoun: { type: String, required: true },
  age: String,
  personality: String,
  role: String,
  values: String,
  memories: [CharacterMemorySchema],
}, { _id: false });

const SeriesSchema = new Schema<ISeries>({
  title: { type: String, required: true },
  key: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  anchor: { type: String, required: true },
  theme: { type: String, required: true },
  characters: [CharacterSchema],
  subscriberCount: { type: Number, default: 0 },
  deletedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

export const Series = mongoose.model<ISeries>('Series', SeriesSchema);
