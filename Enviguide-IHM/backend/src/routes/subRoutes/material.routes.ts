// -- Material / Hazardous Material Mapping Routes ----------
// Nested under /vessels/:vesselId/materials
//
// GET    /api/v1/vessels/:vesselId/materials              (list materials, ?deckId= filter)
// POST   /api/v1/vessels/:vesselId/materials              (create material entry)
// GET    /api/v1/vessels/:vesselId/materials/mapping       (get spatial mapping grouped by deck)
// GET    /api/v1/vessels/:vesselId/materials/summary       (get IHM part summary counts)
// GET    /api/v1/vessels/:vesselId/materials/:id           (get single material)
// PUT    /api/v1/vessels/:vesselId/materials/:id           (update material)
// DELETE /api/v1/vessels/:vesselId/materials/:id           (delete material)
// PATCH  /api/v1/vessels/:vesselId/materials/:id/transfer  (transfer to different deck)
// PATCH  /api/v1/vessels/:vesselId/materials/:id/remap     (complete re-mapping after transfer)

import { Router } from 'express';
import {
  listMaterials, createMaterial, getMaterial,
  updateMaterial, deleteMaterial, getMaterialMapping,
  getMaterialSummary, transferMaterial, remapMaterial,
} from '../../controller/material.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

// Static routes must come BEFORE :id param routes
router.get('/mapping', getMaterialMapping);
router.get('/summary', getMaterialSummary);

router.route('/')
  .get(listMaterials)
  .post(createMaterial);

router.route('/:id')
  .get(getMaterial)
  .put(updateMaterial)
  .delete(deleteMaterial);

router.patch('/:id/transfer', transferMaterial);
router.patch('/:id/remap', remapMaterial);

export default router;
