// -- MD/SDoC Request Controller ----------------------------
import type { Request, Response, NextFunction } from 'express';
import { MdSDocService } from '../services/mdsdoc.service.js';
import { VesselService } from '../services/vessel.service.js';
import { createError } from '../middleware/errorHandler.js';

const VALID_STATUS = ['Pending', 'Received', 'Reminder 1', 'Reminder 2', 'Non-Responsive', 'Tracked', 'Non-Tracked'];

async function verify(userId: string, vesselId: string, next: NextFunction) {
  const v = await VesselService.getVesselByIdForUser(vesselId, userId);
  if (!v) { next(createError('Vessel not found', 404)); return null; }
  return v;
}

/** GET /api/v1/vessels/:vesselId/md-sdoc?status=Pending */
export async function listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    if (!await verify(req.user!.userId, vesselId, next)) return;

    const status = req.query.status as string | undefined;
    const requests = await MdSDocService.listForVessel(vesselId, status);
    res.json({ success: true, data: requests, total: requests.length });
  } catch (err) { next(err); }
}

/** GET /api/v1/vessels/:vesselId/md-sdoc/by-supplier?status=Pending */
export async function getGroupedBySupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    if (!await verify(req.user!.userId, vesselId, next)) return;

    const status = req.query.status as string | undefined;
    const grouped = await MdSDocService.getGroupedBySupplier(vesselId, status);
    res.json({ success: true, data: grouped });
  } catch (err) { next(err); }
}

/** POST /api/v1/vessels/:vesselId/md-sdoc */
export async function createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    if (!await verify(req.user!.userId, vesselId, next)) return;

    const body = req.body as Record<string, unknown>;
    if (!body.itemName || !body.supplierName) {
      return next(createError('itemName and supplierName are required', 400));
    }
    if (body.status && !VALID_STATUS.includes(body.status as string)) {
      return next(createError(`status must be one of: ${VALID_STATUS.join(', ')}`, 400));
    }

    const request = await MdSDocService.create(body, vesselId);
    res.status(201).json({ success: true, data: request });
  } catch (err) { next(err); }
}

/** GET /api/v1/vessels/:vesselId/md-sdoc/:id */
export async function getRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    if (!await verify(req.user!.userId, vesselId, next)) return;

    const request = await MdSDocService.getById(req.params.id as string, vesselId);
    if (!request) return next(createError('Request not found', 404));
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
}

/** PUT /api/v1/vessels/:vesselId/md-sdoc/:id */
export async function updateRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    if (!await verify(req.user!.userId, vesselId, next)) return;

    const existing = await MdSDocService.getById(req.params.id as string, vesselId);
    if (!existing) return next(createError('Request not found', 404));

    const body = req.body as Record<string, unknown>;
    if (body.status && !VALID_STATUS.includes(body.status as string)) {
      return next(createError(`status must be one of: ${VALID_STATUS.join(', ')}`, 400));
    }

    const updated = await MdSDocService.update(req.params.id as string, body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/vessels/:vesselId/md-sdoc/:id/reminder */
export async function sendReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    if (!await verify(req.user!.userId, vesselId, next)) return;

    const existing = await MdSDocService.getById(req.params.id as string, vesselId);
    if (!existing) return next(createError('Request not found', 404));

    const updated = await MdSDocService.sendReminder(req.params.id as string);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/vessels/:vesselId/md-sdoc/:id/received */
export async function markReceived(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    if (!await verify(req.user!.userId, vesselId, next)) return;

    const existing = await MdSDocService.getById(req.params.id as string, vesselId);
    if (!existing) return next(createError('Request not found', 404));

    const updated = await MdSDocService.markReceived(req.params.id as string);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** POST /api/v1/vessels/:vesselId/md-sdoc/generate — auto-generate from hazardous materials */
export async function autoGenerate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    if (!await verify(req.user!.userId, vesselId, next)) return;

    const result = await MdSDocService.generateFromHazardousMaterials(vesselId);
    res.json({
      success: true,
      data: result.requests,
      message: `Generated ${result.generated} new MD/SDoC request(s) from hazardous materials`,
    });
  } catch (err) { next(err); }
}
