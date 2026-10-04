import { Router } from 'express';
import authRouter from './subRoutes/auth.routes.js';
import vesselRouter from './subRoutes/vessel.routes.js';
import purchaseOrderRouter from './subRoutes/purchaseOrder.routes.js';
// materialRouter is now nested under /vessels/:vesselId/materials (see vessel.routes.ts)
import auditRouter from './subRoutes/audit.routes.js';
import securityRouter from './subRoutes/security.routes.js';
import masterRouter from './subRoutes/master.routes.js';
import dashboardRouter from './subRoutes/dashboard.routes.js';
import userRouter from './subRoutes/user.routes.js';
import userCategoryRouter from './subRoutes/userCategory.routes.js';
import permissionRouter from './subRoutes/permission.routes.js';
import menuRouter from './subRoutes/menu.routes.js';
import supplierRouter from './subRoutes/supplier.routes.js';
import equipmentRouter from './subRoutes/equipment.routes.js';
import suspectedKeywordRouter from './subRoutes/suspectedKeyword.routes.js';
import contactRouter from './subRoutes/contact.routes.js';
import publicRouter from './subRoutes/public.routes.js';
import fleetRouter from './subRoutes/fleet.routes.js';
import subFleetRouter from './subRoutes/subFleet.routes.js';
import ownershipRouter from './subRoutes/ownership.routes.js';
import ownershipManagerRouter from './subRoutes/ownershipManager.routes.js';
import suspendedRouter from './subRoutes/suspended.routes.js';
import emailRouter from './subRoutes/email.routes.js';

const router = Router();

// Public supplier portal — mounted FIRST so it doesn't hit any auth middleware.
router.use('/public',              publicRouter);

router.use('/auth',                authRouter);
router.use('/users',               userRouter);
router.use('/user-categories',     userCategoryRouter);
router.use('/permissions',         permissionRouter);
router.use('/menu',                menuRouter);
router.use('/suppliers',           supplierRouter);
router.use('/equipment',           equipmentRouter);
router.use('/suspected-keywords',  suspectedKeywordRouter);
router.use('/contact',             contactRouter);
router.use('/vessels',             vesselRouter);
router.use('/purchase-orders',     purchaseOrderRouter);
// materials routes are now nested under /vessels/:vesselId/materials
router.use('/audits',              auditRouter);
router.use('/security',            securityRouter);
router.use('/master',              masterRouter);
router.use('/dashboard',           dashboardRouter);
router.use('/fleets',              fleetRouter);
router.use('/sub-fleets',          subFleetRouter);
router.use('/ownership',           ownershipRouter);
router.use('/ownership-manager',   ownershipManagerRouter);
router.use('/suspended',           suspendedRouter);
router.use('/send-email',          emailRouter);

export default router;
