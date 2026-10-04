import { Router } from 'express';
import {
  listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier,
} from '../../controller/supplier.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.route('/').get(listSuppliers).post(createSupplier);
router.route('/:id').get(getSupplier).put(updateSupplier).delete(deleteSupplier);

export default router;
