import type { Request, Response, NextFunction } from 'express';
import { DeckAreaService } from '../services/deckArea.service.js';
import { GAPlanService } from '../services/gaPlan.service.js';
import { VesselService } from '../services/vessel.service.js';
import { createError } from '../middleware/errorHandler.js';

/** Verify vessel ownership and GA Plan existence */
async function verifyAccess(userId: string, vesselId: string, planId: string, next: NextFunction) {
  const vessel = await VesselService.getVesselByIdForUser(vesselId, userId);
  if (!vessel) { next(createError('Vessel not found', 404)); return null; }

  const plan = await GAPlanService.getPlanById(planId, vesselId);
  if (!plan) { next(createError('GA Plan not found', 404)); return null; }

  return plan;
}

/** GET /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas */
export async function listDeckAreas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const planId = req.params.planId as string;
    const plan = await verifyAccess(req.user!.userId, vesselId, planId, next);
    if (!plan) return;

    const areas = await DeckAreaService.getAreasForPlan(planId);
    res.json({ success: true, data: areas, total: areas.length });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas */
export async function createDeckArea(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const planId = req.params.planId as string;
    const plan = await verifyAccess(req.user!.userId, vesselId, planId, next);
    if (!plan) return;

    const { name, x, y, width, height, thumbnail } = req.body as {
      name?: string; x?: number; y?: number; width?: number; height?: number; thumbnail?: string;
    };

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return next(createError('Area name is required', 400));
    }
    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      return next(createError('Coordinates (x, y, width, height) are required', 400));
    }
    if (width <= 0 || height <= 0) {
      return next(createError('Width and height must be positive numbers', 400));
    }

    // Rule 1: No duplicate area names
    const nameExists = await DeckAreaService.nameExists(planId, name.trim());
    if (nameExists) {
      return next(createError(`An area named "${name.trim()}" already exists in this GA Plan. Each area must have a unique name.`, 409));
    }

    // Rule 2: No overlapping areas
    const overlapWith = await DeckAreaService.checkOverlap(planId, { x, y, width, height });
    if (overlapWith) {
      return next(createError(`This area overlaps with existing area "${overlapWith}". Areas cannot overlap each other.`, 409));
    }

    const area = await DeckAreaService.createArea({
      gaPlanId: planId,
      name: name.trim(),
      x, y, width, height,
      thumbnail,
    });

    res.status(201).json({ success: true, data: area });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas/:areaId */
export async function getDeckArea(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const planId = req.params.planId as string;
    const areaId = req.params.areaId as string;
    const plan = await verifyAccess(req.user!.userId, vesselId, planId, next);
    if (!plan) return;

    const area = await DeckAreaService.getAreaById(areaId, planId);
    if (!area) return next(createError('Deck area not found', 404));

    res.json({ success: true, data: area });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas/:areaId */
export async function updateDeckArea(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const planId = req.params.planId as string;
    const areaId = req.params.areaId as string;
    const plan = await verifyAccess(req.user!.userId, vesselId, planId, next);
    if (!plan) return;

    const existing = await DeckAreaService.getAreaById(areaId, planId);
    if (!existing) return next(createError('Deck area not found', 404));

    const { name, x, y, width, height, thumbnail } = req.body as {
      name?: string; x?: number; y?: number; width?: number; height?: number; thumbnail?: string;
    };

    // If name is being changed, check for duplicates
    if (name && name.trim() !== existing.name) {
      const nameExists = await DeckAreaService.nameExists(planId, name.trim(), areaId);
      if (nameExists) {
        return next(createError(`An area named "${name.trim()}" already exists in this GA Plan.`, 409));
      }
    }

    // If coordinates are being changed, check for overlaps
    if (x !== undefined || y !== undefined || width !== undefined || height !== undefined) {
      const coords = {
        x: x ?? existing.x,
        y: y ?? existing.y,
        width: width ?? existing.width,
        height: height ?? existing.height,
      };
      if (coords.width <= 0 || coords.height <= 0) {
        return next(createError('Width and height must be positive numbers', 400));
      }
      const overlapWith = await DeckAreaService.checkOverlap(planId, coords, areaId);
      if (overlapWith) {
        return next(createError(`Updated area would overlap with "${overlapWith}". Areas cannot overlap.`, 409));
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name.trim();
    if (x !== undefined) updateData.x = x;
    if (y !== undefined) updateData.y = y;
    if (width !== undefined) updateData.width = width;
    if (height !== undefined) updateData.height = height;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;

    const area = await DeckAreaService.updateArea(areaId, updateData);
    res.json({ success: true, data: area });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas/:areaId */
export async function deleteDeckArea(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const planId = req.params.planId as string;
    const areaId = req.params.areaId as string;
    const plan = await verifyAccess(req.user!.userId, vesselId, planId, next);
    if (!plan) return;

    const existing = await DeckAreaService.getAreaById(areaId, planId);
    if (!existing) return next(createError('Deck area not found', 404));

    await DeckAreaService.deleteArea(areaId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/vessels/:vesselId/ga-plans/:planId/deck-areas (reset all) */
export async function deleteAllDeckAreas(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const planId = req.params.planId as string;
    const plan = await verifyAccess(req.user!.userId, vesselId, planId, next);
    if (!plan) return;

    const result = await DeckAreaService.deleteAllAreas(planId);
    res.json({ success: true, message: `Removed ${result.count} deck area(s)` });
  } catch (err) {
    next(err);
  }
}
