import { Router } from 'express';
import {
  listSubFleets, createSubFleet, updateSubFleet, deleteSubFleet
} from '../../controller/subFleet.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.route('/')
  .get(requirePermission('vessels_read'), listSubFleets)
  .post(requirePermission('vessels_create'), createSubFleet);

router.route('/:id')
  .put(requirePermission('vessels_update'), updateSubFleet)
  .delete(requirePermission('vessels_delete'), deleteSubFleet);

export default router;
