import { Router } from 'express';
import {
  listSuspended, getSuspended, createSuspended, updateSuspended, deleteSuspended,
} from '../../controller/suspended.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.route('/')
  .get(listSuspended)
  .post(createSuspended);

router.route('/:id')
  .get(getSuspended)
  .put(updateSuspended)
  .delete(deleteSuspended);

export default router;
