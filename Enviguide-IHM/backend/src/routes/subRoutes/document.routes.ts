// -- Document Routes (nested under /vessels/:vesselId/documents) ----
// GET    /api/v1/vessels/:vesselId/documents              (list, ?documentType= ?status= ?search=)
// POST   /api/v1/vessels/:vesselId/documents              (upload — form-data: file + metadata)
// GET    /api/v1/vessels/:vesselId/documents/:id          (get single)
// PUT    /api/v1/vessels/:vesselId/documents/:id          (update metadata/status)
// DELETE /api/v1/vessels/:vesselId/documents/:id          (delete)

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  listDocuments, uploadDocument, getDocument, updateDocument, deleteDocument, streamDocument,
} from '../../controller/document.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'documents');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `doc-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|jpg|jpeg|png|doc|docx|xls|xlsx)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Only PDF, image, Word, or Excel files allowed'));
  },
});

const router = Router({ mergeParams: true });
router.use(authenticate);

router.route('/')
  .get(listDocuments)
  .post(upload.single('file'), uploadDocument);

// Stream proxy — serves file inline (for iframe preview) or as attachment (for download)
// ?disposition=attachment triggers download mode
router.get('/:id/stream', streamDocument);

router.route('/:id')
  .get(getDocument)
  .put(updateDocument)
  .delete(deleteDocument);

export default router;

