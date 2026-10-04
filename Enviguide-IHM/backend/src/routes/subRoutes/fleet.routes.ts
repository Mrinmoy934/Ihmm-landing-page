import { Router } from 'express';
import {
  listFleets, createFleet, updateFleet, deleteFleet
} from '../../controller/fleet.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.route('/')
  .get(requirePermission('vessels_read'), listFleets)
  .post(requirePermission('vessels_create'), createFleet);

router.route('/:id')
  .put(requirePermission('vessels_update'), updateFleet)
  .delete(requirePermission('vessels_delete'), deleteFleet);

export default router;
