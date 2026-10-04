import type { Request, Response, NextFunction } from 'express';
import { EquipmentService } from '../services/equipment.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await EquipmentService.list({
      systemType: req.query.systemType as string | undefined,
      manufacturer: req.query.manufacturer as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

export async function getEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const e = await EquipmentService.getById(req.params.id as string);
    if (!e) return next(createError('Equipment not found', 404));
    res.json({ success: true, data: e });
  } catch (err) { next(err); }
}

export async function createEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const e = await EquipmentService.create(req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: e });
  } catch (err) {
    if (err instanceof Error) return next(createError(err.message, 400));
    next(err);
  }
}

export async function updateEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const e = await EquipmentService.update(req.params.id as string, req.body as Record<string, unknown>);
    if (!e) return next(createError('Equipment not found', 404));
    res.json({ success: true, data: e });
  } catch (err) { next(err); }
}

export async function deleteEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await EquipmentService.getById(req.params.id as string);
    if (!existing) return next(createError('Equipment not found', 404));
    await EquipmentService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}
