// -- Dashboard Routes -------------------------------------
// GET /api/v1/dashboard/stats
// GET /api/v1/dashboard/soc-alerts

import { Router } from 'express';
import { getDashboardStats, getDashboardOverview, getDashboardInventory, getSocAlerts } from '../../controller/dashboard.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/stats',      getDashboardStats);
router.get('/overview',   getDashboardOverview);
router.get('/inventory',  getDashboardInventory);
router.get('/soc-alerts', getSocAlerts);

export default router;
