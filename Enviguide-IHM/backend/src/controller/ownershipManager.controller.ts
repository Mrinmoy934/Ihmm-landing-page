import type { Request, Response, NextFunction } from 'express';
import { OwnershipManagerService } from '../services/ownershipManager.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listOwnershipManagers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await OwnershipManagerService.list({
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

export async function getOwnershipManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const m = await OwnershipManagerService.getById(req.params.id as string);
    if (!m) return next(createError('Manager not found', 404));
    res.json({ success: true, data: m });
  } catch (err) { next(err); }
}

export async function createOwnershipManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const m = await OwnershipManagerService.create(req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: m });
  } catch (err) {
    if (err instanceof Error) return next(createError(err.message, 400));
    next(err);
  }
}

export async function updateOwnershipManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const m = await OwnershipManagerService.update(req.params.id as string, req.body as Record<string, unknown>);
    if (!m) return next(createError('Manager not found', 404));
    res.json({ success: true, data: m });
  } catch (err) { next(err); }
}

export async function deleteOwnershipManager(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await OwnershipManagerService.getById(req.params.id as string);
    if (!existing) return next(createError('Manager not found', 404));
    await OwnershipManagerService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}
