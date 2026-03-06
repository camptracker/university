export interface Lesson {
  day: number;
  title: string;
  date: string;
  standard: string;
  parable: string;
  sonnet?: string;
  image?: string;
  audio?: string;
}

export interface Series {
  id: string;
  name: string;
  theme: string;
  lessons: Lesson[];
}

import { lessons as fiLessons } from './series/financial-independence';
import { lessons as nutritionLessons } from './series/nutrition-science';
import { lessons as negotiationLessons } from './series/negotiation';
import { lessons as stoicLessons } from './series/stoic-philosophy';
import { lessons as musicLessons } from './series/music-theory';
import { lessons as realEstateLessons } from './series/real-estate';
import { lessons as storytellingLessons } from './series/storytelling';
import { lessons as relationshipLessons } from './series/building-relationships';
import { lessons as cookingLessons } from './series/cooking';
import { lessons as meaningLessons } from './series/meaning-of-life';
import { lessons as scaleLessons } from './series/how-to-scale';
import { lessons as mlLessons } from './series/machine-learning';
import { lessons as eqLessons } from './series/emotional-intelligence';
import { lessons as habitsLessons } from './series/habits-and-systems';
import { lessons as leadershipLessons } from './series/leadership';
import { lessons as longevityLessons } from './series/health-and-longevity';
import { lessons as weddingLessons } from './series/wedding-planning';
import { lessons as israelLessons } from './series/history-of-israel';
import { lessons as printingLessons } from './series/3d-printing';

export const series: Series[] = [
  { id: "financial-independence", name: "Financial Independence", theme: "Warren Buffett's teachings and mathematical principles", lessons: fiLessons },
  { id: "nutrition-science", name: "Nutrition Science", theme: "the science of how food fuels your body, from macronutrients to metabolism", lessons: nutritionLessons },
  { id: "negotiation", name: "Negotiation", theme: "FBI hostage negotiation tactics, persuasion psychology, and everyday deal-making", lessons: negotiationLessons },
  { id: "stoic-philosophy", name: "Stoic Philosophy", theme: "ancient Stoic teachings — mental resilience, emotional control, and living with purpose", lessons: stoicLessons },
  { id: "music-theory", name: "Music Theory", theme: "the building blocks of music — notes, scales, chords, rhythm, harmony, and why certain sounds make you feel things", lessons: musicLessons },
  { id: "real-estate", name: "Real Estate Investing", theme: "building wealth through property — from your first rental to cash flow analysis and passive income", lessons: realEstateLessons },
  { id: "storytelling", name: "Storytelling", theme: "the craft of storytelling — narrative structure, character arcs, tension, pacing, dialogue, and what makes stories unforgettable", lessons: storytellingLessons },
  { id: "building-relationships", name: "Building Relationships", theme: "the science and art of building lasting romantic relationships — communication, love languages, conflict resolution, emotional intelligence, trust, and growing together", lessons: relationshipLessons },
  { id: "cooking", name: "Cooking", theme: "the art and science of cooking — techniques, flavor profiles, knife skills, heat control, seasoning, and the chemistry behind why recipes work", lessons: cookingLessons },
  { id: "meaning-of-life", name: "Meaning of Life", theme: "the deepest philosophical question — existentialism, religion, absurdism, purpose, consciousness, and what thinkers from Aristotle to Camus to Viktor Frankl have said about why we're here", lessons: meaningLessons },
  { id: "how-to-scale", name: "How to Scale", theme: "scaling startups, teams, and systems — from 0→1 to 1→100, hiring, delegation, technical architecture, organizational design, and lessons from founders who built billion-dollar companies", lessons: scaleLessons },
  { id: "machine-learning", name: "Machine Learning", theme: "the fundamentals of machine learning — from linear regression to neural networks, gradient descent, backpropagation, transformers, and the math and intuition behind how machines learn", lessons: mlLessons },
  { id: "emotional-intelligence", name: "Emotional Intelligence", theme: "understanding and managing emotions — self-awareness, empathy, social skills, emotional regulation, and reading people", lessons: eqLessons },
  { id: "habits-and-systems", name: "Habits & Systems", theme: "building identity-based habits, designing systems that compound, breaking bad loops, and becoming the person who does the things", lessons: habitsLessons },
  { id: "leadership", name: "Leadership & Influence", theme: "inspiring people, building trust, servant leadership, giving feedback, mentoring, and the difference between authority and influence", lessons: leadershipLessons },
  { id: "health-and-longevity", name: "Health & Longevity", theme: "the science of living longer and better — sleep, exercise physiology, stress management, aging, recovery, and the habits that add decades of healthy life", lessons: longevityLessons },
  { id: "wedding-planning", name: "Wedding Planning", theme: "the art and philosophy of planning a wedding — what truly matters, balancing traditions with authenticity, managing family dynamics, budgeting wisely, and creating a celebration that reflects who you are as a couple", lessons: weddingLessons },
  { id: "history-of-israel", name: "History of Israel", theme: "the complete history of Israel — influence, roles, secrets, and intentions from ancient times to modern statehood", lessons: israelLessons },
  { id: "3d-printing", name: "3D Printing", theme: "from fundamentals to mastery — materials, mechanics, slicing, design principles, and real-world applications of 3D printing", lessons: printingLessons },
];

// Find a series by id
export function getSeriesById(id: string): Series | undefined {
  return series.find(s => s.id === id);
}

// Get the latest day number for a series
export function getLatestDay(seriesId: string): number {
  const s = getSeriesById(seriesId);
  if (!s || s.lessons.length === 0) return 0;
  return Math.max(...s.lessons.map(l => l.day));
}

// Get a specific lesson by series id and day
export function getLesson(seriesId: string, day: number): Lesson | undefined {
  const s = getSeriesById(seriesId);
  return s?.lessons.find(l => l.day === day);
}
