import type { Request, Response, NextFunction } from 'express';
import { FleetService } from '../services/fleet.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listFleets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const result = await FleetService.getFleets({ search, limit, offset });
    res.json({ success: true, data: result.data, total: result.total });
  } catch (err) {
    next(err);
  }
}

export async function createFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, owner, manager } = req.body as { name?: string; owner?: string; manager?: string };
    if (!name || !name.trim()) {
      return next(createError('Fleet name is required', 400));
    }

    const fleet = await FleetService.createFleet({ name: name.trim(), owner, manager });
    res.status(201).json({ success: true, data: fleet });
  } catch (err) {
    next(err);
  }
}

export async function updateFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, owner, manager } = req.body as { name?: string; owner?: string; manager?: string };
    const id = req.params.id as string;

    const existing = await FleetService.getFleetById(id);
    if (!existing) {
      return next(createError('Fleet not found', 404));
    }

    const fleet = await FleetService.updateFleet(id, { name: name?.trim(), owner, manager });
    res.json({ success: true, data: fleet });
  } catch (err) {
    next(err);
  }
}

export async function deleteFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await FleetService.getFleetById(id);
    if (!existing) {
      return next(createError('Fleet not found', 404));
    }

    await FleetService.deleteFleet(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
