import type { Request, Response, NextFunction } from 'express';
import { PermissionService } from '../services/permission.service.js';
import { createError } from '../middleware/errorHandler.js';
import { AuthService } from '../services/auth.service.js';

/** GET /api/v1/permissions/nodes — full permission tree */
export async function listPermissionNodes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tree = await PermissionService.listNodes();
    res.json({ success: true, data: tree });
  } catch (err) { next(err); }
}

/** POST /api/v1/permissions/nodes — upsert a node */
export async function upsertPermissionNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, label, parentId, sortOrder } = req.body as {
      id?: string; label?: string; parentId?: string | null; sortOrder?: number;
    };
    if (!id || !label) return next(createError('id and label are required', 400));
    await PermissionService.upsertNode(id, label, parentId ?? null, sortOrder ?? 0);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function deletePermissionNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await PermissionService.deleteNode(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}

/** GET /api/v1/permissions/users/:userId */
export async function getUserPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.userId as string;
    const ids = await PermissionService.getUserPermissions(userId);

    if (ids.includes('__custom_override__')) {
      res.json({ success: true, data: ids.filter(x => x !== '__custom_override__') });
    } else {
      const user = await AuthService.findUserById(userId);
      if (!user) {
        return next(createError('User not found', 404));
      }
      let roleName = user.role_name;
      const cat = (user.category || '').toLowerCase();
      if (!roleName) {
        if (cat.includes('super')) {
          roleName = 'superadmin';
        } else if (cat.includes('admin')) {
          roleName = 'admin';
        } else if (cat.includes('manager')) {
          roleName = 'ship_manager';
        } else if (cat.includes('staff')) {
          roleName = 'staff';
        }
      }
      const normalizedRole = roleName ? roleName.toLowerCase() : '';
      let rolePerms: string[] = [];
      if (normalizedRole) {
        rolePerms = await PermissionService.getRolePermissions(normalizedRole).catch(() => []);
      }
      res.json({ success: true, data: rolePerms });
    }
  } catch (err) { next(err); }
}

/** PUT /api/v1/permissions/users/:userId  body: { nodeIds: string[] } */
export async function setUserPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nodeIds } = req.body as { nodeIds?: unknown };
    if (!Array.isArray(nodeIds)) return next(createError('nodeIds[] is required', 400));
    const customNodeIds = [...new Set([...(nodeIds as string[]), '__custom_override__'])];
    await PermissionService.setUserPermissions(req.params.userId as string, customNodeIds);
    res.json({ success: true });
  } catch (err) { next(err); }
}

/** GET /api/v1/permissions/roles/:roleName */
export async function getRolePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ids = await PermissionService.getRolePermissions(req.params.roleName as string);
    res.json({ success: true, data: ids });
  } catch (err) { next(err); }
}

/** PUT /api/v1/permissions/roles/:roleName  body: { nodeIds: string[] } */
export async function setRolePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nodeIds } = req.body as { nodeIds?: unknown };
    if (!Array.isArray(nodeIds)) return next(createError('nodeIds[] is required', 400));
    await PermissionService.setRolePermissions(req.params.roleName as string, nodeIds as string[]);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function listRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roles = await PermissionService.listRoles();
    res.json({ success: true, data: roles });
  } catch (err) { next(err); }
}
