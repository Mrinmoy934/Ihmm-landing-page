import type { Request, Response, NextFunction } from 'express';
import { SupplierService } from '../services/supplier.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await SupplierService.list({
      category: req.query.category as string | undefined,
      location: req.query.location as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

export async function getSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const s = await SupplierService.getById(req.params.id as string);
    if (!s) return next(createError('Supplier not found', 404));
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const s = await SupplierService.create(req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: s });
  } catch (err) {
    if (err instanceof Error) return next(createError(err.message, 400));
    next(err);
  }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const s = await SupplierService.update(req.params.id as string, req.body as Record<string, unknown>);
    if (!s) return next(createError('Supplier not found', 404));
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
}

export async function deleteSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await SupplierService.getById(req.params.id as string);
    if (!existing) return next(createError('Supplier not found', 404));
    await SupplierService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}
