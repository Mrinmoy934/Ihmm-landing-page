import { Router } from 'express';
import {
  listOwnershipManagers, getOwnershipManager, createOwnershipManager, updateOwnershipManager, deleteOwnershipManager,
} from '../../controller/ownershipManager.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.route('/')
  .get(listOwnershipManagers)
  .post(createOwnershipManager);

router.route('/:id')
  .get(getOwnershipManager)
  .put(updateOwnershipManager)
  .delete(deleteOwnershipManager);

export default router;
