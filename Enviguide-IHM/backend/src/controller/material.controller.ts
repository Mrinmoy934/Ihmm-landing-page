// -- Material Controller (Hazardous Material Mapping) ------
import type { Request, Response, NextFunction } from 'express';
import { MaterialService } from '../services/material.service.js';
import { VesselService } from '../services/vessel.service.js';
import { createError } from '../middleware/errorHandler.js';

const VALID_IHM_PARTS = ['Part I', 'Part II', 'Part III'];
const VALID_CATEGORIES = ['hazard', 'safe', 'warning'];

/** GET /api/v1/vessels/:vesselId/materials */
export async function listMaterials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const deckId = req.query.deckId as string | undefined;
    const deckAreaId = req.query.deckAreaId as string | undefined;
    const materials = await MaterialService.getMaterialsForVessel(vesselId, deckId, deckAreaId);
    const total = await MaterialService.getMaterialCount(vesselId);

    res.json({ success: true, data: materials, total });
  } catch (err) { next(err); }
}

/** POST /api/v1/vessels/:vesselId/materials */
export async function createMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const body = req.body as Record<string, unknown>;

    // Validate required fields
    if (!body.name || (typeof body.name === 'string' && body.name.trim() === '')) {
      return next(createError('Material name is required', 400));
    }
    if (!body.ihmPart || !VALID_IHM_PARTS.includes(body.ihmPart as string)) {
      return next(createError(`IHM Part is required and must be one of: ${VALID_IHM_PARTS.join(', ')}`, 400));
    }

    // Default category to 'warning' if not provided
    if (body.category && !VALID_CATEGORIES.includes(body.category as string)) {
      return next(createError(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`, 400));
    }

    // Handle pin coordinates from frontend { pin: { x, y } } format
    if (body.pin && typeof body.pin === 'object') {
      const pin = body.pin as { x?: number; y?: number };
      body.pinX = pin.x;
      body.pinY = pin.y;
      delete body.pin;
    }

    const deckId = body.deckId as string | undefined;
    const deckAreaId = body.deckAreaId as string | undefined;
    delete body.deckId;
    delete body.deckAreaId;

    const material = await MaterialService.createMaterial(body, vesselId, deckId, deckAreaId);
    res.status(201).json({ success: true, data: material });
  } catch (err) { next(err); }
}

/** GET /api/v1/vessels/:vesselId/materials/:id */
export async function getMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const material = await MaterialService.getMaterialById(req.params.id as string, vesselId);
    if (!material) return next(createError('Material not found', 404));

    res.json({ success: true, data: material });
  } catch (err) { next(err); }
}

/** PUT /api/v1/vessels/:vesselId/materials/:id */
export async function updateMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const existing = await MaterialService.getMaterialById(req.params.id as string, vesselId);
    if (!existing) return next(createError('Material not found', 404));

    const body = req.body as Record<string, unknown>;

    // Validate IHM Part if provided
    if (body.ihmPart && !VALID_IHM_PARTS.includes(body.ihmPart as string)) {
      return next(createError(`IHM Part must be one of: ${VALID_IHM_PARTS.join(', ')}`, 400));
    }
    if (body.category && !VALID_CATEGORIES.includes(body.category as string)) {
      return next(createError(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`, 400));
    }

    // Handle pin from frontend
    if (body.pin && typeof body.pin === 'object') {
      const pin = body.pin as { x?: number; y?: number };
      body.pinX = pin.x;
      body.pinY = pin.y;
      delete body.pin;
    }

    const material = await MaterialService.updateMaterial(req.params.id as string, body);
    res.json({ success: true, data: material });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/vessels/:vesselId/materials/:id */
export async function deleteMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const existing = await MaterialService.getMaterialById(req.params.id as string, vesselId);
    if (!existing) return next(createError('Material not found', 404));

    await MaterialService.deleteMaterial(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}

/** GET /api/v1/vessels/:vesselId/materials/mapping */
export async function getMaterialMapping(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const mapping = await MaterialService.getMaterialMapping(vesselId);
    res.json({ success: true, data: mapping });
  } catch (err) { next(err); }
}

/** GET /api/v1/vessels/:vesselId/materials/summary */
export async function getMaterialSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const summary = await MaterialService.getMaterialSummary(vesselId);
    const total = await MaterialService.getMaterialCount(vesselId);
    res.json({ success: true, data: { summary, total } });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/vessels/:vesselId/materials/:id/transfer
 *  Moves material to a new deck. Clears the pin coordinates so user must re-map.
 *  Returns the material with pre-filled details + requiresRemap flag.
 */
export async function transferMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const existing = await MaterialService.getMaterialById(req.params.id as string, vesselId);
    if (!existing) return next(createError('Material not found', 404));

    const { deckId } = req.body as { deckId?: string };
    if (!deckId) {
      return next(createError('Target deckId is required', 400));
    }

    const sourceDeckId = (existing as Record<string, unknown>).deckId;
    const material = await MaterialService.transferMaterial(req.params.id as string, deckId);

    res.json({
      success: true,
      data: material,
      meta: {
        requiresRemap: true,
        sourceDeckId,
        targetDeckId: deckId,
        message: 'Technical details have been pre-filled. Please click on the plan to set the new location.',
      },
    });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/vessels/:vesselId/materials/:id/remap
 *  Completes re-mapping after deck transfer: sets new pin + updates location details.
 */
export async function remapMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const existing = await MaterialService.getMaterialById(req.params.id as string, vesselId);
    if (!existing) return next(createError('Material not found', 404));

    const body = req.body as Record<string, unknown>;

    // Pin is required for re-mapping
    if (!body.pin || typeof body.pin !== 'object') {
      return next(createError('New pin location (pin: {x, y}) is required for re-mapping', 400));
    }

    const pin = body.pin as { x?: number; y?: number };
    if (pin.x === undefined || pin.y === undefined) {
      return next(createError('Pin must include both x and y coordinates', 400));
    }

    body.pinX = pin.x;
    body.pinY = pin.y;
    delete body.pin;

    const material = await MaterialService.remapMaterial(req.params.id as string, body);
    res.json({ success: true, data: material });
  } catch (err) { next(err); }
}
