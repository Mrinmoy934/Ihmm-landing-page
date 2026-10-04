import type { Request, Response, NextFunction } from 'express';
import { GAPlanService } from '../services/gaPlan.service.js';
import { VesselService } from '../services/vessel.service.js';
import { persistUploadedFile } from '../services/storage.service.js';
import { createError } from '../middleware/errorHandler.js';

/** GET /api/v1/vessels/:vesselId/ga-plans */
export async function listGAPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const vesselId = req.params.vesselId as string;

    // Verify vessel belongs to user
    const vessel = await VesselService.getVesselByIdForUser(vesselId, userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const plans = await GAPlanService.getPlansForVessel(vesselId);
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/vessels/:vesselId/ga-plans */
export async function uploadGAPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const vesselId = req.params.vesselId as string;

    // Verify vessel belongs to user
    const vessel = await VesselService.getVesselByIdForUser(vesselId, userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    if (!req.file) {
      return next(createError('GA Plan image file is required', 400));
    }

    const name = (req.body.name as string) || req.file.originalname.replace(/\.[^/.]+$/, '');

    // Push the file through the storage service so on production the file
    // ends up in Supabase / R2 / S3 and we store a public URL — not the
    // ephemeral container disk path. Local dev with no S3 config falls back
    // to /uploads/ga-plans/<file> served by express.static.
    const stored = await persistUploadedFile(req.file.path, req.file.originalname, 'ga-plans');

    const plan = await GAPlanService.createPlan({
      vesselId,
      name,
      fileName: stored.name,
      filePath: stored.url,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/vessels/:vesselId/ga-plans/:planId */
export async function getGAPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const vesselId = req.params.vesselId as string;
    const planId = req.params.planId as string;

    const vessel = await VesselService.getVesselByIdForUser(vesselId, userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const plan = await GAPlanService.getPlanById(planId, vesselId);
    if (!plan) return next(createError('GA Plan not found', 404));

    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/vessels/:vesselId/ga-plans/:planId */
export async function updateGAPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const vesselId = req.params.vesselId as string;
    const planId = req.params.planId as string;
    const { name } = req.body as { name?: string };

    const vessel = await VesselService.getVesselByIdForUser(vesselId, userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const existing = await GAPlanService.getPlanById(planId, vesselId);
    if (!existing) return next(createError('GA Plan not found', 404));

    if (!name || !name.trim()) {
      return next(createError('Name is required', 400));
    }

    const plan = await GAPlanService.updatePlan(planId, name.trim());
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/vessels/:vesselId/ga-plans/:planId */
export async function deleteGAPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const vesselId = req.params.vesselId as string;
    const planId = req.params.planId as string;

    const vessel = await VesselService.getVesselByIdForUser(vesselId, userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const existing = await GAPlanService.getPlanById(planId, vesselId);
    if (!existing) return next(createError('GA Plan not found', 404));

    await GAPlanService.deletePlan(planId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
