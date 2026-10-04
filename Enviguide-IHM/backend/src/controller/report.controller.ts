// -- Report controller -----------------------------------------------------
// Routes:
//   GET  /api/v1/vessels/:vesselId/reports
//        — List historical generations for the vessel.
//   POST /api/v1/vessels/:vesselId/reports/:type/generate
//        — Run the renderer; returns metadata + base64 PDF inline.
//   GET  /api/v1/vessels/:vesselId/reports/:type/download
//        — Convenience: generate + stream PDF to the browser in one go.
//        Used by the Generate buttons on the Reports tab.

import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { ReportService, type ReportType } from '../services/report.service.js';
import { VesselService } from '../services/vessel.service.js';
import { createError } from '../middleware/errorHandler.js';

const VALID_TYPES: ReportType[] = ['compliance', 'inventory', 'hazmat', 'quarterly', 'overall'];

function parseType(raw: unknown): ReportType {
  const t = String(raw ?? '').toLowerCase();
  if (!VALID_TYPES.includes(t as ReportType)) {
    throw createError(`Unsupported report type. Use one of: ${VALID_TYPES.join(', ')}`, 400);
  }
  return t as ReportType;
}

/** GET /vessels/:vesselId/reports */
export async function listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));
    const rows = await ReportService.list(vesselId);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

/** GET /vessels/:vesselId/reports/:type/download
 *
 *  Optional query overrides for quarterly reports — used by the
 *  Quarterly Archive Generate buttons to render a *specific* past
 *  quarter rather than the current one:
 *    ?periodLabel=Q2%202026
 *    &periodStart=2026-04-01
 *    &periodEnd=2026-06-30
 *  All three must be supplied together; partial sets are ignored. */
export async function downloadReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const type = parseType(req.params.type);
    const generatedBy = req.user?.email || 'Unknown';

    const { periodLabel, periodStart, periodEnd } = req.query as {
      periodLabel?: string; periodStart?: string; periodEnd?: string;
    };
    const period =
      periodLabel && periodStart && periodEnd
        ? {
            label: periodLabel,
            start: new Date(periodStart),
            end: new Date(periodEnd),
          }
        : undefined;

    const result = await ReportService.generate({ vesselId, type, generatedBy, period });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('Content-Length', String(result.fileSize));
    res.send(result.pdf);
  } catch (err) { next(err); }
}

/** GET /vessels/:vesselId/reports/quarterly/timeline
 *
 *  Returns one row per calendar quarter from the vessel's onboarding
 *  date through the current quarter, with the matching report row
 *  attached (or null when no report has been generated yet for that
 *  quarter). The Quarterly Archive tab renders one card per row. */
export async function listQuarterlyTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));
    const timeline = await ReportService.timeline(vesselId);
    res.json({ success: true, data: timeline });
  } catch (err) { next(err); }
}

/** GET /vessels/:vesselId/reports/:reportId/file
 *  Re-stream a previously generated PDF (Quarterly Archive download). */
export async function streamReportFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const vessel = await VesselService.getVesselByIdForUser(vesselId, req.user!.userId);
    if (!vessel) return next(createError('Vessel not found', 404));

    const reportId = req.params.reportId as string;
    const rows = await ReportService.list(vesselId);
    const row = rows.find((r) => r.id === reportId);
    if (!row || !row.fileName) return next(createError('Report not found', 404));

    // The DB stores file_path; refetch directly so we don't expose it
    // via list (which trims to public-safe fields).
    const path = await import('path');
    const fileURL = await import('url');
    const __dirname = path.dirname(fileURL.fileURLToPath(import.meta.url));
    const fullPath = path.resolve(__dirname, '..', '..', 'uploads', 'reports', String(row.fileName));
    if (!fs.existsSync(fullPath)) return next(createError('Report file missing on server', 410));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${row.fileName}"`);
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) { next(err); }
}
