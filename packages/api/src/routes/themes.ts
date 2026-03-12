/**
 * Themes routes — mounted at /api/themes
 * 
 * Routes:
 * - GET /api/themes/daily — returns cached daily themes
 * - POST /api/themes/generate — manually trigger theme generation (admin only)
 */
import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { requireAdmin } from '../middleware/auth.js';
import { generateDailyThemes } from '../services/themeGenerator.js';

const router = Router();
const CACHE_PATH = path.join(process.cwd(), 'data', 'daily-themes.json');

// GET /api/themes/daily - returns cached daily themes
router.get('/daily', async (_req: Request, res: Response) => {
  try {
    const data = await fs.readFile(CACHE_PATH, 'utf-8');
    const cached = JSON.parse(data);
    res.json(cached);
  } catch (err) {
    // If no cache exists, return empty array
    console.error('Failed to read daily themes cache:', err);
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
