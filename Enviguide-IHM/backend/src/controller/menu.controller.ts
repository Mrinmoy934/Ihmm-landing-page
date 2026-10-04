import type { Request, Response, NextFunction } from 'express';
import { MenuService } from '../services/menu.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listMenuItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const archived = req.query.archived === 'true';
    const data = await MenuService.list(archived);
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

export async function getMenuItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await MenuService.getById(req.params.id as string);
    if (!item) return next(createError('Menu item not found', 404));
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function createMenuItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await MenuService.create(req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    if (err instanceof Error) return next(createError(err.message, 400));
    next(err);
  }
}

export async function updateMenuItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await MenuService.update(req.params.id as string, req.body as Record<string, unknown>);
    if (!item) return next(createError('Menu item not found', 404));
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function archiveMenuItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await MenuService.archive(req.params.id as string);
    if (!item) return next(createError('Menu item not found', 404));
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function restoreMenuItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await MenuService.restore(req.params.id as string);
    if (!item) return next(createError('Menu item not found', 404));
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
}

export async function deleteMenuItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await MenuService.getById(req.params.id as string);
    if (!existing) return next(createError('Menu item not found', 404));
    await MenuService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}
