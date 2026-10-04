// -- Purchase Order Routes --------------------------------
// GET    /api/v1/purchase-orders                       (?vesselId= ?status= ?supplier=)
// POST   /api/v1/purchase-orders                       (create with body)
// POST   /api/v1/purchase-orders/upload                (file upload + auto-create audit)
// GET    /api/v1/purchase-orders/by-supplier/:vesselId (grouped by supplier)
// GET    /api/v1/purchase-orders/:id
// PUT    /api/v1/purchase-orders/:id
// DELETE /api/v1/purchase-orders/:id

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  listPurchaseOrders, createPurchaseOrder, getPurchaseOrder,
  updatePurchaseOrder, deletePurchaseOrder, uploadPurchaseOrder,
  uploadPurchaseOrderBulk, getPurchaseOrdersBySupplier,
} from '../../controller/purchaseOrder.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'po');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 25 * 1024 * 1024,
    // Bulk uploads send parsed rows as a JSON text field; default 1MB is too
    // small — 6933 rows already produces ~1.5MB. Allow up to 50MB.
    fieldSize: 50 * 1024 * 1024,
  },
});

const router = Router();
router.use(authenticate);

router.get('/by-supplier/:vesselId', getPurchaseOrdersBySupplier);
router.post('/upload', upload.single('file'), uploadPurchaseOrder);
router.post('/upload-bulk', upload.single('file'), uploadPurchaseOrderBulk);

router.route('/')
  .get(listPurchaseOrders)
  .post(createPurchaseOrder);

router.route('/:id')
  .get(getPurchaseOrder)
  .put(updatePurchaseOrder)
  .delete(deletePurchaseOrder);

export default router;
