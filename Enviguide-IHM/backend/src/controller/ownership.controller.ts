import type { Request, Response, NextFunction } from 'express';
import { OwnershipService } from '../services/ownership.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await OwnershipService.list({
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

export async function getOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const o = await OwnershipService.getById(req.params.id as string);
    if (!o) return next(createError('Owner not found', 404));
    res.json({ success: true, data: o });
  } catch (err) { next(err); }
}

export async function createOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const o = await OwnershipService.create(req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: o });
  } catch (err) {
    if (err instanceof Error) return next(createError(err.message, 400));
    next(err);
  }
}

export async function updateOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const o = await OwnershipService.update(req.params.id as string, req.body as Record<string, unknown>);
    if (!o) return next(createError('Owner not found', 404));
    res.json({ success: true, data: o });
  } catch (err) { next(err); }
}

export async function deleteOwnership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await OwnershipService.getById(req.params.id as string);
    if (!existing) return next(createError('Owner not found', 404));
    await OwnershipService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}
