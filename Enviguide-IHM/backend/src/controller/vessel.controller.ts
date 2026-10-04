// -- Vessel Controller ----------------------------------------
import type { Request, Response, NextFunction } from 'express';
import { VesselService } from '../services/vessel.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function listVessels(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const vessels = await VesselService.getVesselsByUser(userId);
    res.json({ success: true, data: vessels });
  } catch (err) { next(err); }
}

export async function createVessel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { name, imoNumber, shipOwner } = req.body as Record<string, string>;

    if (!name || !imoNumber || !shipOwner) {
      return next(createError('Fields name, imoNumber, and shipOwner are required', 400));
    }

    if (!/^\d{7}$/.test(imoNumber)) {
      return next(createError('IMO number must be exactly 7 digits', 400));
    }

    const existing = await VesselService.getVesselByImo(imoNumber);
    if (existing) {
      return next(createError(`Vessel with IMO ${imoNumber} already exists`, 409));
    }

    const vessel = await VesselService.createVessel(req.body, userId);
    res.status(201).json({ success: true, data: vessel });
  } catch (err) { next(err); }
}

export async function getVessel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const vessel = await VesselService.getVesselByIdForUser(req.params.id as string, userId);
    if (!vessel) {
      return next(createError('Vessel not found', 404));
    }
    res.json({ success: true, data: vessel });
  } catch (err) { next(err); }
}

export async function updateVessel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const existing = await VesselService.getVesselByIdForUser(req.params.id as string, userId);
    if (!existing) {
      return next(createError('Vessel not found', 404));
    }

    // If IMO is being changed, check for duplicates
    const { imoNumber } = req.body as Record<string, string>;
    if (imoNumber && imoNumber !== existing.imoNumber) {
      if (!/^\d{7}$/.test(imoNumber)) {
        return next(createError('IMO number must be exactly 7 digits', 400));
      }
      const duplicate = await VesselService.getVesselByImo(imoNumber);
      if (duplicate) {
        return next(createError(`Vessel with IMO ${imoNumber} already exists`, 409));
      }
    }

    const vessel = await VesselService.updateVessel(req.params.id as string, req.body);
    res.json({ success: true, data: vessel });
  } catch (err) { next(err); }
}

export async function deleteVessel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const existing = await VesselService.getVesselByIdForUser(req.params.id as string, userId);
    if (!existing) {
      return next(createError('Vessel not found', 404));
    }
    await VesselService.deleteVessel(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function uploadVesselImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const existing = await VesselService.getVesselByIdForUser(req.params.id as string, userId);
    if (!existing) {
      return next(createError('Vessel not found', 404));
    }

    if (!req.file) {
      return next(createError('No image file provided', 400));
    }

    const imagePath = `/uploads/vessels/${req.file.filename}`;
    const vessel = await VesselService.updateVessel(req.params.id as string, { image: imagePath });
    res.json({ success: true, data: vessel });
  } catch (err) { next(err); }
}

/** GET /api/v1/vessels/:id/project-status — Check if project section is complete */
export async function getProjectStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const vessel = await VesselService.getVesselByIdForUser(req.params.id as string, userId);
    if (!vessel) {
      return next(createError('Vessel not found', 404));
    }

    const v = vessel as Record<string, unknown>;

    // Required project fields that must be filled before accessing Decks
    const requiredFields: { key: string; label: string }[] = [
      { key: 'name', label: 'Vessel Name' },
      { key: 'imoNumber', label: 'IMO Number' },
      { key: 'shipOwner', label: 'Ship Owner' },
      { key: 'vesselType', label: 'Vessel Type' },
      { key: 'flagState', label: 'Flag State' },
      { key: 'grossTonnage', label: 'Gross Tonnage' },
    ];

    const missingFields: string[] = [];
    for (const field of requiredFields) {
      const value = v[field.key];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(field.label);
      }
    }

    const isComplete = missingFields.length === 0;

    res.json({
      success: true,
      data: {
        isComplete,
        missingFields,
        message: isComplete
          ? 'Project section is complete. You can proceed to Decks.'
          : `Please complete the following fields in the Project section first: ${missingFields.join(', ')}`,
      },
    });
  } catch (err) { next(err); }
}

export async function getVesselDecks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const vessel = await VesselService.getVesselByIdForUser(req.params.id as string, userId);
    if (!vessel) {
      return next(createError('Vessel not found', 404));
    }
    res.json({ success: true, data: vessel.decks });
  } catch (err) { next(err); }
}

export async function getVesselMaterials(_req: Request, res: Response, _next: NextFunction): Promise<void> {
  // Placeholder - will be implemented with Materials module
  res.json({ success: true, data: [] });
}

export async function getVesselCertificates(_req: Request, res: Response, _next: NextFunction): Promise<void> {
  // Placeholder - will be implemented with Certificates module
  res.json({ success: true, data: [] });
}
