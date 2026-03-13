/**
 * Themes routes — mounted at /api/themes
 * 
 * Routes:
 * - GET /api/themes/daily — returns daily themes from MongoDB
 * - POST /api/themes/generate — manually trigger theme generation (admin only)
 */
import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { generateDailyThemes } from '../services/themeGenerator.js';
import { DailyThemes } from '../models/DailyThemes.js';

const router = Router();

// GET /api/themes/daily - returns daily themes from database
router.get('/daily', async (_req: Request, res: Response) => {
  try {
    const cached = await DailyThemes.findOne().lean();
    if (!cached) {
      res.json({ themes: [], generatedAt: null });
      return;
    }
    res.json({ 
      themes: cached.themes, 
      generatedAt: cached.generatedAt.toISOString() 
    });
  } catch (err) {
    console.error('Failed to read daily themes from database:', err);
    res.json({ themes: [], generatedAt: null });
  }
});

// POST /api/themes/generate - manually trigger generation (admin only)
router.post('/generate', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const themes = await generateDailyThemes();
    res.json({ success: true, themes, generatedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Theme generation failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
