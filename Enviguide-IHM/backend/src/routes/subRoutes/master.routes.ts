// -- Master Data Routes -----------------------------------
// Suppliers, Equipment, SuspectedKeywords, Registered, Ownership

import { Router } from 'express';
import {
  listSuppliers, createSupplier, getSupplier, updateSupplier,
  listEquipment, createEquipment,
  listSuspectedKeywords, createSuspectedKeyword,
  listRegistered,
  listOwnership, updateOwnership,
} from '../../controller/master.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/suppliers',           listSuppliers);
router.post('/suppliers',          authorize('admin', 'manager'), createSupplier);
router.get('/suppliers/:id',       getSupplier);
router.put('/suppliers/:id',       authorize('admin', 'manager'), updateSupplier);

router.get('/equipment',           listEquipment);
router.post('/equipment',          authorize('admin', 'manager'), createEquipment);

router.get('/suspected-keywords',  listSuspectedKeywords);
router.post('/suspected-keywords', authorize('admin'), createSuspectedKeyword);

router.get('/registered',          listRegistered);

router.get('/ownership',           listOwnership);
router.put('/ownership',           authorize('admin', 'manager'), updateOwnership);

export default router;
