/**
 * Application entry point.
 *
 * Configures Express middleware (helmet, cors, cookie-parser, passport),
 * rate limiters, all route handlers, static file serving for the web SPA,
 * MongoDB connection, and cron job startup.
 *
 * Middleware order: helmet → cors → json → cookieParser → passport →
 * authLimiter (/auth) → generalLimiter (/api) → routes → static → SPA fallback
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import passport from 'passport';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import seriesRoutes from './routes/series.js';
import subscriptionRoutes from './routes/subscriptions.js';
import lessonRoutes from './routes/lessons.js';
import userRoutes from './routes/users.js';
import { generalLimiter, authLimiter } from './middleware/rateLimiter.js';
import { startOrchestrateSeriesCron, startOrchestrateProgressCron } from './jobs/crons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Allow serving SPA
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
}));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/auth', authLimiter);
app.use('/api', generalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/series', subscriptionRoutes);
app.use('/api', lessonRoutes);
app.use('/api/users', userRoutes);

// ─── Serve Frontend ───────────────────────────────────────────────────────────
const webDistPath = path.resolve(__dirname, '../../web/dist');
app.use(express.static(webDistPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// SPA fallback — must be after API routes
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(webDistPath, 'index.html'));
});

// ─── Database ─────────────────────────────────────────────────────────────────
async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

// ─── Start ────────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await connectDB();

  if (process.env.NODE_ENV !== 'test') {
    startOrchestrateSeriesCron();
    startOrchestrateProgressCron();
  }

  app.listen(PORT, () => {
    console.log(`Parable API v2 running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
