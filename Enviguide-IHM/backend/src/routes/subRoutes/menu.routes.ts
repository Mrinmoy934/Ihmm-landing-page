import { Router } from 'express';
import {
  listMenuItems, getMenuItem, createMenuItem, updateMenuItem,
  archiveMenuItem, restoreMenuItem, deleteMenuItem,
} from '../../controller/menu.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.route('/')
  .get(listMenuItems)
  .post(authorize('admin'), createMenuItem);

router.post('/:id/archive', authorize('admin'), archiveMenuItem);
router.post('/:id/restore', authorize('admin'), restoreMenuItem);

router.route('/:id')
  .get(getMenuItem)
  .put(authorize('admin'), updateMenuItem)
  .delete(authorize('admin'), deleteMenuItem);

export default router;
