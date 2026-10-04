// -- Vessel Routes ----------------------------------------
// GET    /api/v1/vessels
// POST   /api/v1/vessels
// GET    /api/v1/vessels/:id
// PUT    /api/v1/vessels/:id
// DELETE /api/v1/vessels/:id
// POST   /api/v1/vessels/:id/image
// GET    /api/v1/vessels/:id/project-status
// GET    /api/v1/vessels/:id/decks
// GET    /api/v1/vessels/:id/materials
// GET    /api/v1/vessels/:id/certificates

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  listVessels, createVessel, getVessel,
  updateVessel, deleteVessel, uploadVesselImage,
  getProjectStatus, getVesselCertificates,
} from '../../controller/vessel.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import gaPlanRouter from './gaPlan.routes.js';
import deckRouter from './deck.routes.js';
import materialRouter from './material.routes.js';
import documentRouter from './document.routes.js';
import mdsdocRouter from './mdsdoc.routes.js';
import reportRouter from './report.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'vessels');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|gif)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
    }
  },
});

const router = Router();
router.use(authenticate);

router.route('/')
  .get(listVessels)
  .post(createVessel);

router.route('/:id')
  .get(getVessel)
  .put(updateVessel)
  .delete(deleteVessel);

router.post('/:id/image', upload.single('image'), uploadVesselImage);

router.get('/:id/project-status', getProjectStatus);
router.get('/:id/certificates', getVesselCertificates);

// Deck routes (nested: /vessels/:vesselId/decks/...)
router.use('/:vesselId/decks', deckRouter);

// Material routes (nested: /vessels/:vesselId/materials/...)
router.use('/:vesselId/materials', materialRouter);

// Document routes (nested: /vessels/:vesselId/documents/...)
router.use('/:vesselId/documents', documentRouter);

// MD/SDoC request routes (nested: /vessels/:vesselId/md-sdoc/...)
router.use('/:vesselId/md-sdoc', mdsdocRouter);

// GA Plan routes (nested: /vessels/:vesselId/ga-plans/...)
router.use('/:vesselId/ga-plans', gaPlanRouter);

// Report routes (nested: /vessels/:vesselId/reports/...)
router.use('/:vesselId/reports', reportRouter);

export default router;
