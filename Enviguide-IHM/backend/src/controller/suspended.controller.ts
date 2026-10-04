import type { Request, Response, NextFunction } from 'express';
import { SuspendedService } from '../services/suspended.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listSuspended(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await SuspendedService.list({
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

export async function getSuspended(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const s = await SuspendedService.getById(req.params.id as string);
    if (!s) return next(createError('Suspended record not found', 404));
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
}

export async function createSuspended(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const s = await SuspendedService.create(req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: s });
  } catch (err) {
    if (err instanceof Error) return next(createError(err.message, 400));
    next(err);
  }
}

export async function updateSuspended(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const s = await SuspendedService.update(req.params.id as string, req.body as Record<string, unknown>);
    if (!s) return next(createError('Suspended record not found', 404));
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
}

export async function deleteSuspended(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await SuspendedService.getById(req.params.id as string);
    if (!existing) return next(createError('Suspended record not found', 404));
    await SuspendedService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}
