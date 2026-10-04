// ============================================================
// IHM EnviGuide - Backend Entry Point
// ============================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestLog } from './middleware/requestLog.js';
import { logger } from './utils/logger.js';

// Route modules
import rootRouter from './routes/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// -- Security & Parsing ------------------------------------
app.use(helmet());

// CORS_ORIGIN may be a single origin or a comma-separated list. Empty strings are
// dropped so trailing commas don't accidentally match every origin.
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Requests without an Origin header (curl, server-to-server) are allowed.
    if (!origin) return cb(null, true);
    const isAllowed = 
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('duckdns.org');

    if (isAllowed) return cb(null, true);
    logger.warn(`CORS request blocked for origin: ${origin}`);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// requestLog runs after morgan so its lines bracket the morgan output:
//   ↓ APP    → POST /api/v1/auth/login        (request entered)
//   ↓ MORGAN POST /api/v1/auth/login 200 142ms (request done — morgan)
//   ↓ APP    ← POST /api/v1/auth/login 200    (request done — app log)
app.use(requestLog);

// -- Static Files (uploads) --------------------------------
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

// -- Health Check ------------------------------------------
// Touches the DB on purpose: this endpoint is also what the
// GitHub Actions keepalive cron pings every ~10 min, so one hit
// keeps both the Render dyno and the Supabase pooler warm.
app.get('/health', async (_req, res) => {
  try {
    const { getDb } = await import('./config/database.js');
    await getDb().command({ ping: 1 });
    res.json({ status: 'ok', db: 'reachable', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      db: 'unreachable',
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// -- API Routes --------------------------------------------
const API = '/api/v1';
app.use(API, rootRouter);

// -- Error Handling ----------------------------------------
app.use(notFound);
app.use(errorHandler);

// -- Start Server ------------------------------------------
app.listen(env.PORT, () => {
  logger.info(`IHM API running → http://localhost:${env.PORT}/api/v1 (env=${env.NODE_ENV})`);
});

export default app;

