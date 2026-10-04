import type { Request, Response, NextFunction } from 'express';
import { SubFleetService } from '../services/subFleet.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listSubFleets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const result = await SubFleetService.getSubFleets({ search, limit, offset });
    res.json({ success: true, data: result.data, total: result.total });
  } catch (err) {
    next(err);
  }
}

export async function createSubFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, parentFleetId, parentFleetName, owner, manager } = req.body as {
      name?: string; parentFleetId?: string; parentFleetName?: string; owner?: string; manager?: string;
    };
    if (!name || !name.trim()) {
      return next(createError('Sub-fleet name is required', 400));
    }
    if (!parentFleetId || !parentFleetName) {
      return next(createError('Parent fleet details are required', 400));
    }

    const subFleet = await SubFleetService.createSubFleet({
      name: name.trim(), parentFleetId, parentFleetName, owner, manager
    });
    res.status(201).json({ success: true, data: subFleet });
  } catch (err) {
    next(err);
  }
}

export async function updateSubFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, parentFleetId, parentFleetName, owner, manager } = req.body as {
      name?: string; parentFleetId?: string; parentFleetName?: string; owner?: string; manager?: string;
    };
    const id = req.params.id as string;

    const existing = await SubFleetService.getSubFleetById(id);
    if (!existing) {
      return next(createError('Sub-fleet not found', 404));
    }

    const subFleet = await SubFleetService.updateSubFleet(id, {
      name: name?.trim(), parentFleetId, parentFleetName, owner, manager
    });
    res.json({ success: true, data: subFleet });
  } catch (err) {
    next(err);
  }
}

export async function deleteSubFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await SubFleetService.getSubFleetById(id);
    if (!existing) {
      return next(createError('Sub-fleet not found', 404));
    }

    await SubFleetService.deleteSubFleet(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
