import { Router } from 'express';
import {
  listOwnership, getOwnership, createOwnership, updateOwnership, deleteOwnership,
} from '../../controller/ownership.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.route('/')
  .get(listOwnership)
  .post(createOwnership);

router.route('/:id')
  .get(getOwnership)
  .put(updateOwnership)
  .delete(deleteOwnership);

export default router;
