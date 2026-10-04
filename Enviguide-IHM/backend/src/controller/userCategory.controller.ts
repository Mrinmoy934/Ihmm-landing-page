import type { Request, Response, NextFunction } from 'express';
import { UserCategoryService } from '../services/userCategory.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const archived = req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined;
    const data = await UserCategoryService.list({
      archived,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

export async function getCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await UserCategoryService.getById(req.params.id as string);
    if (!cat) return next(createError('Category not found', 404));
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await UserCategoryService.create(req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: cat });
  } catch (err) {
    if (err instanceof Error) return next(createError(err.message, 400));
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await UserCategoryService.update(req.params.id as string, req.body as Record<string, unknown>);
    if (!cat) return next(createError('Category not found', 404));
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await UserCategoryService.getById(req.params.id as string);
    if (!existing) return next(createError('Category not found', 404));
    await UserCategoryService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function archiveCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await UserCategoryService.setArchived(req.params.id as string, true);
    if (!cat) return next(createError('Category not found', 404));
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
}

export async function restoreCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await UserCategoryService.setArchived(req.params.id as string, false);
    if (!cat) return next(createError('Category not found', 404));
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
}
