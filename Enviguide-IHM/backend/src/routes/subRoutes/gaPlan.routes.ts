// -- GA Plan & Deck Area Routes ----------------------------
// POST   /api/v1/vessels/:vesselId/ga-plans          (upload GA Plan image)
// GET    /api/v1/vessels/:vesselId/ga-plans           (list all GA Plans)
// GET    /api/v1/vessels/:vesselId/ga-plans/:planId   (get single GA Plan + deck areas)
// PUT    /api/v1/vessels/:vesselId/ga-plans/:planId   (update GA Plan name)
// DELETE /api/v1/vessels/:vesselId/ga-plans/:planId   (delete GA Plan + file)
//
// GET    /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas           (list deck areas)
// POST   /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas           (create deck area)
// GET    /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas/:areaId   (get single area)
// PUT    /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas/:areaId   (update area)
// DELETE /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas/:areaId   (delete area)
// DELETE /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas           (reset all areas)

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  listGAPlans, uploadGAPlan, getGAPlan, updateGAPlan, deleteGAPlan,
} from '../../controller/gaPlan.controller.js';
import {
  listDeckAreas, createDeckArea, getDeckArea, updateDeckArea, deleteDeckArea, deleteAllDeckAreas,
} from '../../controller/deckArea.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'ga-plans');

// Ensure upload directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `ga-plan-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB for GA Plans (technical drawings can be large)
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPG image files are allowed'));
    }
  },
});

const router = Router({ mergeParams: true });
router.use(authenticate);

// GA Plan routes
router.route('/')
  .get(listGAPlans)
  .post(upload.single('file'), uploadGAPlan);

router.route('/:planId')
  .get(getGAPlan)
  .put(updateGAPlan)
  .delete(deleteGAPlan);

// Deck Area routes (nested under GA Plan)
router.route('/:planId/deck-areas')
  .get(listDeckAreas)
  .post(createDeckArea)
  .delete(deleteAllDeckAreas);

router.route('/:planId/deck-areas/:areaId')
  .get(getDeckArea)
  .put(updateDeckArea)
  .delete(deleteDeckArea);

export default router;
