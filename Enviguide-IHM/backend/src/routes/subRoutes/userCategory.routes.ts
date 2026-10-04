// -- User Category Routes ----------------------------------
import { Router } from 'express';
import {
  listCategories, getCategory, createCategory, updateCategory,
  deleteCategory, archiveCategory, restoreCategory,
} from '../../controller/userCategory.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.route('/')
  .get(listCategories)
  .post(authorize('admin'), createCategory);

router.post('/:id/archive', authorize('admin'), archiveCategory);
router.post('/:id/restore', authorize('admin'), restoreCategory);

router.route('/:id')
  .get(getCategory)
  .put(authorize('admin'), updateCategory)
  .delete(authorize('admin'), deleteCategory);

export default router;
