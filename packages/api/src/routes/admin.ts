/**
 * Admin routes — mounted at /api/admin
 * 
 * Routes:
 * - POST /api/admin/dedup-lessons — Find and soft-delete duplicate lessons
 */
import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { Lesson } from '../models/Lesson.js';

const router = Router();

// POST /api/admin/dedup-lessons - Find and remove duplicate lessons (keep oldest)
router.post('/dedup-lessons', requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Find duplicates using aggregation
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
      res.json({ ok: true, message: 'No duplicates found', deleted: 0, groups: 0 });
      return;
    }

    let totalDeleted = 0;
    const details = [];

    for (const dup of duplicates) {
      const { seriesId, sortOrder } = dup._id;
      const lessons = dup.lessons.sort((a: any, b: any) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      // Keep the oldest, delete the rest
      const kept = lessons[0];
      const toDelete = lessons.slice(1);
      
      for (const lesson of toDelete) {
        await Lesson.findByIdAndUpdate(lesson._id, { deletedAt: new Date() });
        totalDeleted++;
      }
      
      details.push({
        seriesId: String(seriesId),
        sortOrder,
        count: dup.count,
        kept: kept.title,
        deleted: toDelete.map((l: any) => l.title)
      });
    }

    res.json({
      ok: true,
      message: `Deduplication complete`,
      deleted: totalDeleted,
      groups: duplicates.length,
      details
    });

  } catch (err) {
    console.error('Dedup error:', err);
    const msg = err instanceof Error ? err.message : 'Deduplication failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
