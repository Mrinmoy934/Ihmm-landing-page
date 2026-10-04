// -- Public (no-auth) routes for the supplier upload portal ----------

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getPublicClarification,
  uploadPublicMdsDocument,
  deletePublicMdsDocument,
  submitPublicClarification,
} from '../../controller/publicSupplier.controller.js';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mdsDir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'mds');
if (!fs.existsSync(mdsDir)) fs.mkdirSync(mdsDir, { recursive: true });

const upload = multer({
  dest: mdsDir,
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Rough per-IP rate limit so a leaked link can't be used to spam us.
// 30 requests / 60 seconds; shared across GET and POST.
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_HITS = 30;
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_HITS) return false;
  entry.count++;
  return true;
}

const router = Router();

router.use((req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
  if (!rateLimit(ip)) {
    res.status(429).json({ success: false, error: { message: 'Too many requests, slow down.' } });
    return;
  }
  next();
});

router.get('/clarifications/:token', getPublicClarification);
// Each item now carries two doc slots: :kind ∈ { 'md', 'sdoc' }.
router.post(
  '/clarifications/:token/items/:idx/document/:kind',
  upload.single('file'),
  uploadPublicMdsDocument,
);
// Delete + Submit accept JSON bodies (no file upload) — parse JSON inline.
router.delete(
  '/clarifications/:token/items/:idx/document/:kind',
  express.json(),
  deletePublicMdsDocument,
);
router.post(
  '/clarifications/:token/submit',
  express.json(),
  submitPublicClarification,
);

export default router;
