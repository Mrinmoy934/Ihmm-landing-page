// -- MD/SDoC Request Routes (nested under /vessels/:vesselId/md-sdoc) ----
// GET    /api/v1/vessels/:vesselId/md-sdoc                       (?status=Pending)
// GET    /api/v1/vessels/:vesselId/md-sdoc/by-supplier            (?status=Pending)
// POST   /api/v1/vessels/:vesselId/md-sdoc                       (create)
// POST   /api/v1/vessels/:vesselId/md-sdoc/generate              (auto-gen from hazmat)
// GET    /api/v1/vessels/:vesselId/md-sdoc/:id
// PUT    /api/v1/vessels/:vesselId/md-sdoc/:id
// PATCH  /api/v1/vessels/:vesselId/md-sdoc/:id/reminder
// PATCH  /api/v1/vessels/:vesselId/md-sdoc/:id/received

import { Router } from 'express';
import {
  listRequests, createRequest, getRequest, updateRequest,
  sendReminder, markReceived, autoGenerate, getGroupedBySupplier,
} from '../../controller/mdsdoc.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/by-supplier', getGroupedBySupplier);
router.post('/generate', autoGenerate);

router.route('/')
  .get(listRequests)
  .post(createRequest);

router.route('/:id')
  .get(getRequest)
  .put(updateRequest);

router.patch('/:id/reminder', sendReminder);
router.patch('/:id/received', markReceived);

export default router;
