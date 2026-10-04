import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/auth.service.js';
import { PermissionService } from '../services/permission.service.js';
import { createError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { AuthPayload } from '../middleware/auth.middleware.js';

const log = logger.child('auth');

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return next(createError('Email and password are required', 400));
    }

    // Authorization is enforced by the database (the user must exist and be
    // active). The previous @enviguide.com email gate blocked admin-created
    // Ship Manager accounts that legitimately use other domains, so it's
    // gone — DB lookup + status === 'active' is the real gate.

    const user = await AuthService.findUserByEmail(email);
    if (!user) {
      log.warn(`login fail (no user) email=${email}`);
      return next(createError('Invalid credentials', 401));
    }

    if (user.status !== 'active') {
      log.warn(`login fail (deactivated) email=${email}`);
      return next(createError('Account is deactivated', 403));
    }

    const valid = await AuthService.verifyPassword(password, user.password);
    if (!valid) {
      log.warn(`login fail (bad password) email=${email}`);
      return next(createError('Invalid credentials', 401));
    }

    const token = AuthService.generateToken(user);
    log.info(`login ok user=${user.name} (${user.email})`);

    // Fire-and-forget last activity update
    AuthService.updateLastActivity(user.id).catch(() => {});

    res.json({
      success: true,
      data: {
        token,
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.category,
          vesselId: user.vessel_id ?? null,
          shipManager: user.ship_manager ?? null,
          shipOwner: user.ship_owner ?? null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(createError('No token provided', 401));
    }

    const oldToken = authHeader.slice(7);
    let payload: AuthPayload;
    try {
      payload = jwt.verify(oldToken, env.JWT_SECRET) as AuthPayload;
    } catch {
      return next(createError('Invalid or expired token', 401));
    }

    const user = await AuthService.findUserById(payload.userId);
    if (!user || user.status !== 'active') {
      return next(createError('User not found or deactivated', 401));
    }

    const token = AuthService.generateToken(user);
    res.json({ success: true, data: { token } });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await AuthService.findUserById(req.user!.userId);
    if (!user) {
      return next(createError('User not found', 404));
    }

    const userPerms = await PermissionService.getUserPermissions(user.id);
    let effective: string[] = [];
    let roleName = (user as { role_name?: string | null }).role_name;

    if (userPerms.includes('__custom_override__')) {
      effective = userPerms.filter(x => x !== '__custom_override__');
    } else {
      let rolePerms: string[] = [];
      
      if (!roleName) {
        const cat = (user.category || '').toLowerCase();
        if (cat.includes('super')) {
          roleName = 'superadmin';
        } else if (cat.includes('admin')) {
          roleName = 'admin';
        } else if (cat.includes('manager')) {
          roleName = 'ship_manager';
        } else if (cat.includes('vessel')) {
          roleName = 'vessel';
        } else if (cat.includes('owner')) {
          roleName = 'owner';
        }
      }

      const normalizedRole = roleName ? roleName.toLowerCase() : '';
      if (normalizedRole) {
        rolePerms = await PermissionService.getRolePermissions(normalizedRole).catch(() => []);
      }
      effective = Array.from(new Set([...userPerms, ...rolePerms]));
    }

    // 'isAdmin' bypasses the permission check on the frontend — admin /
    // superadmin users see everything regardless of grants.
    const cat  = (user.category || '').toLowerCase();
    const role = (roleName || '').toLowerCase();
    const isAdminOrSuper = (s: string) =>
      s === 'superadmin' || s.includes('super') || s === 'admin' || s.includes('admin');
    const isAdmin = isAdminOrSuper(cat) || isAdminOrSuper(role);

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.category,
        roleName: roleName ?? null,
        phone: user.phone,
        country: user.country,
        status: user.status,
        isAdmin,
        permissions: effective,
        vesselId: user.vessel_id ?? null,
        shipManager: user.ship_manager ?? null,
        shipOwner: user.ship_owner ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}
