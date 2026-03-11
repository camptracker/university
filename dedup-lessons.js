/**
 * Deduplication script for lessons with duplicate sortOrder values.
 * 
 * Finds all lessons with duplicate (seriesId, sortOrder) combinations
 * and keeps only the oldest one (by createdAt), soft-deleting the rest.
 * 
 * Run with: node dedup-lessons.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from packages/api/.env
dotenv.config({ path: join(__dirname, 'packages/api/.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment');
  process.exit(1);
}

// Lesson schema (minimal)
const lessonSchema = new mongoose.Schema({
  seriesId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sortOrder: { type: Number, required: true },
  title: String,
  createdAt: { type: Date, default: Date.now },
  deletedAt: Date,
});

const Lesson = mongoose.model('Lesson', lessonSchema, 'lessons');

async function deduplicateLessons() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected');

    console.log('\n🔍 Finding duplicate lessons...');
    
    // Aggregate to find duplicates
    const duplicates = await Lesson.aggregate([
      {
        $match: {
          deletedAt: { $exists: false }
        }
      },
      {
        $group: {
          _id: { seriesId: '$seriesId', sortOrder: '$sortOrder' },
          lessons: { $push: { _id: '$_id', title: '$title', createdAt: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      await mongoose.disconnect();
      return;
    }

    console.log(`\n⚠️  Found ${duplicates.length} duplicate groups:\n`);

    let totalDeleted = 0;

    for (const dup of duplicates) {
      const { seriesId, sortOrder } = dup._id;
      const lessons = dup.lessons.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      console.log(`📚 Series ${seriesId}, Day ${sortOrder}:`);
      console.log(`   ${dup.count} copies found`);
      console.log(`   Keeping: ${lessons[0].title} (${lessons[0].createdAt})`);
      
      // Keep the oldest, delete the rest
      const toDelete = lessons.slice(1);
      
      for (const lesson of toDelete) {
        console.log(`   🗑️  Deleting: ${lesson.title} (${lesson.createdAt})`);
        await Lesson.findByIdAndUpdate(lesson._id, { deletedAt: new Date() });
        totalDeleted++;
      }
      
      console.log('');
    }

    console.log(`\n✅ Deduplication complete!`);
    console.log(`   ${totalDeleted} duplicate lessons soft-deleted`);
    console.log(`   ${duplicates.length} groups cleaned`);

    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');

  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

deduplicateLessons();
