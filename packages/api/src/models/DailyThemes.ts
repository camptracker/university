/**
 * DailyThemes model — stores AI-generated theme recommendations
 * 
 * Single document updated daily by cron job. Always uses the same _id
 * to ensure only one theme set exists at a time.
 */
import mongoose, { Document, Schema } from 'mongoose';

interface DailyTheme {
  emoji: string;
  title: string;
  topic: string;
}

export interface IDailyThemes extends Document {
  themes: DailyTheme[];
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DailyThemesSchema = new Schema<IDailyThemes>({
  themes: [{
    emoji: { type: String, required: true },
    title: { type: String, required: true },
    topic: { type: String, required: true },
  }],
  generatedAt: { type: Date, required: true },
}, {
  timestamps: true,
});

export const DailyThemes = mongoose.model<IDailyThemes>('DailyThemes', DailyThemesSchema);
