// ============================================================
// Auth Middleware - JWT Verification
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { createError } from './errorHandler.js';
import { PermissionService } from '../services/permission.service.js';
import { AuthService } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(createError('No token provided', 401));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch (err: any) {
    logger.error(`JWT verification failed: ${err.message}. Token: ${token ? token.substring(0, 15) : 'none'}...`);
    next(createError('Invalid or expired token', 401));
  }
}

/** Role-based guard - use after authenticate() */
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Forbidden - insufficient permissions', 403));
    }

    const userRole = (req.user.role || '').toLowerCase();

    // Check if the user's role is in the list of allowed roles.
    // Also, if the route allows 'admin', a user with 'superadmin' role should be automatically allowed.
    const hasMatch = roles.some((r) => {
      const target = r.toLowerCase();
      if (userRole === target) return true;
      if (target === 'admin' && (userRole === 'superadmin' || userRole.includes('super'))) return true;
      return false;
    });

    if (!hasMatch) {
      return next(createError('Forbidden - insufficient permissions', 403));
    }
    next();
  };
}

/** Permission-based node guard - use after authenticate() */
export function requirePermission(nodeId: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(createError('Unauthorized', 401));
    }

      try {
        const user = await AuthService.findUserById(req.user.userId);
        if (!user || user.status !== 'active') {
          return next(createError('Unauthorized', 401));
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

        // Superadmin bypasses permission checks:
        if (normalizedRole === 'superadmin' || cat.includes('super')) {
          return next();
        }

        const userPerms = await PermissionService.getUserPermissions(user.id);
        const effective = new Set<string>();
        
        if (userPerms.includes('__custom_override__')) {
          userPerms.forEach(x => {
            if (x !== '__custom_override__') effective.add(x);
          });
        } else {
          let rolePerms: string[] = [];
          if (normalizedRole) {
            rolePerms = await PermissionService.getRolePermissions(normalizedRole).catch(() => []);
          }
          userPerms.forEach(x => effective.add(x));
          rolePerms.forEach(x => effective.add(x));
        }

        if (!effective.has(nodeId)) {
          return next(createError('Forbidden - insufficient permissions', 403));
        }
        next();
      } catch (err) {
        next(err);
      }
  };
}
