import type { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await UserService.list({
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data: users, total: users.length });
  } catch (err) { next(err); }
}

export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserService.getById(req.params.id as string);
    if (!user) return next(createError('User not found', 404));
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserService.create(req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    if (err instanceof Error) return next(createError(err.message, 400));
    next(err);
  }
}

export async function createUsersBulk(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { users } = req.body as { users?: Array<Record<string, unknown>> };
    if (!users || !Array.isArray(users)) {
      return next(createError('users array is required', 400));
    }
    const created = await UserService.createBulk(users);
    res.status(201).json({ success: true, data: created, total: created.length });
  } catch (err) { next(err); }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserService.update(req.params.id as string, req.body as Record<string, unknown>);
    if (!user) return next(createError('User not found', 404));
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await UserService.getById(req.params.id as string);
    if (!existing) return next(createError('User not found', 404));
    await UserService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function assignUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roleName, category } = req.body as { roleName?: string; category?: string };
    if (!roleName) return next(createError('roleName is required', 400));
    const user = await UserService.assignRole(req.params.id as string, roleName, category);
    if (!user) return next(createError('User not found', 404));
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

/** GET /api/v1/users/me — current authenticated user's profile */
export async function getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserService.getById(req.user!.userId);
    if (!user) return next(createError('User not found', 404));
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

/** PUT /api/v1/users/me — update own profile */
export async function updateMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    // Non-admins can't change category, status or role
    delete body.category;
    delete body.status;
    delete body.roleName;
    const user = await UserService.update(req.user!.userId, body);
    if (!user) return next(createError('User not found', 404));
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

/** POST /api/v1/users/me/avatar — upload own avatar */
export async function uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) return next(createError('File required', 400));
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    const user = await UserService.setAvatar(req.user!.userId, avatarPath);
    if (!user) return next(createError('User not found', 404));
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}
