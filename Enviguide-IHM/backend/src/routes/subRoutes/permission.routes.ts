// -- Permissions / Rights Routes ---------------------------
// GET    /api/v1/permissions/nodes                 (full tree)
// POST   /api/v1/permissions/nodes                 (upsert)
// DELETE /api/v1/permissions/nodes/:id
// GET    /api/v1/permissions/roles                 (distinct role names)
// GET    /api/v1/permissions/users/:userId         (user's grants)
// PUT    /api/v1/permissions/users/:userId         (replace — body: {nodeIds})
// GET    /api/v1/permissions/roles/:roleName
// PUT    /api/v1/permissions/roles/:roleName

import { Router } from 'express';
import {
  listPermissionNodes, upsertPermissionNode, deletePermissionNode,
  getUserPermissions, setUserPermissions,
  getRolePermissions, setRolePermissions, listRoles,
} from '../../controller/permission.controller.js';
import { authenticate, authorize, requirePermission } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/nodes', listPermissionNodes);
router.post('/nodes', requirePermission('security_update'), upsertPermissionNode);
router.delete('/nodes/:id', requirePermission('security_update'), deletePermissionNode);

router.get('/roles', listRoles);
router.route('/roles/:roleName')
  .get(getRolePermissions)
  .put(requirePermission('security_update'), setRolePermissions);

router.route('/users/:userId')
  .get(getUserPermissions)
  .put(requirePermission('security_update'), setUserPermissions);

export default router;
