import crypto from 'crypto';
import fs from 'fs';
import path from 'url';
import fsp from 'fs/promises';
import { fileURLToPath } from 'url';
import { getDb } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { renderPdf } from './reports/renderer.js';
import {
  buildQuarterlyComplianceData,
  quarterContaining,
  quartersSince,
  lifetimePeriod,
  type ReportPeriod,
} from './reports/data.js';
import {
  renderQuarterlyComplianceHtml,
  footerTemplate,
} from './reports/templates/quarterly-compliance.js';
import { renderComplianceSummaryHtml } from './reports/templates/compliance-summary.js';
import { renderMaterialsInventoryHtml } from './reports/templates/materials-inventory.js';
import { renderHazmatOverviewHtml } from './reports/templates/hazmat-overview.js';
import type { ReportData } from './reports/data.js';

const log = logger.child('report');

export type ReportType = 'compliance' | 'inventory' | 'hazmat' | 'quarterly' | 'overall';

const __dirname = path.fileURLToPath(new URL('.', import.meta.url));
const REPORTS_DIR = path.fileURLToPath(new URL('../../uploads/reports', import.meta.url));

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function reportTitle(type: ReportType): string {
  switch (type) {
    case 'compliance': return 'Compliance Summary Report';
    case 'inventory':  return 'Detailed Materials Inventory Report';
    case 'hazmat':     return 'Global Hazmat Overview Report';
    case 'quarterly':  return 'Quarterly Compliance Report';
    case 'overall':    return 'Ship Overall Report';
  }
}

function fileSafe(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function renderHtmlForType(type: ReportType, data: ReportData): string {
  switch (type) {
    case 'compliance': return renderComplianceSummaryHtml(data);
    case 'inventory':  return renderMaterialsInventoryHtml(data);
    case 'hazmat':     return renderHazmatOverviewHtml(data);
    case 'overall':    return renderQuarterlyComplianceHtml(data, 'Ship Overall Report');
    case 'quarterly':  return renderQuarterlyComplianceHtml(data, 'Quarterly IHM Report');
  }
}

export interface GenerateOptions {
  vesselId: string;
  type: ReportType;
  period?: ReportPeriod;
  generatedBy: string;
}

export interface GeneratedReport {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  pdf: Buffer;
}

export const ReportService = {
  /** Render and persist a report. Returns the PDF buffer alongside the
   *  DB row so the controller can stream it to the browser without a
   *  second filesystem read. */
  async generate(opts: GenerateOptions): Promise<GeneratedReport> {
    const period =
      opts.period
      ?? (opts.type === 'overall' ? await lifetimePeriod(opts.vesselId) : quarterContaining());
    const t0 = Date.now();
    log.info(`generate start type=${opts.type} vessel=${opts.vesselId} period=${period.label}`);
    const data = await buildQuarterlyComplianceData(
      opts.vesselId,
      period,
      opts.generatedBy,
    );
    const tBuild = Date.now() - t0;
    log.debug(`data built in ${tBuild}ms — vessel=${data.vessel.name} materials=${data.materialGroups.reduce((n, g) => n + g.rows.length, 0)} hazmat=${data.hazmatOverview.filter((t) => t.count > 0).length}/16`);

    const db = getDb();
    const reportId = crypto.randomUUID();

    // Insert a 'generating' row so concurrent calls don't race.
    await db.collection('reports').insertOne({
      _id: reportId,
      vessel_id: opts.vesselId,
      report_type: opts.type,
      period_label: period.label,
      period_start: period.start,
      period_end: period.end,
      status: 'generating',
      generated_by: opts.generatedBy,
      created_at: new Date(),
      updated_at: new Date()
    });

    try {
      const tRender0 = Date.now();
      const html = renderHtmlForType(opts.type, data);
      const pdf = await renderPdf(html, {
        displayHeaderFooter: true,
        footerTemplate: footerTemplate(data),
        margin: { top: '14mm', bottom: '18mm', left: '12mm', right: '12mm' },
      });
      const tRender = Date.now() - tRender0;

      ensureDir(REPORTS_DIR);
      const fileName = `${fileSafe(data.vessel.imoNumber)}_${fileSafe(period.label)}_${reportTitle(opts.type).replace(/\s+/g, '-')}.pdf`;
      const fullPath = path.fileURLToPath(new URL(`../../uploads/reports/${fileName}`, import.meta.url));
      fs.writeFileSync(fullPath, pdf);

      await db.collection('reports').updateOne(
        { _id: reportId },
        {
          $set: {
            status: 'ready',
            file_name: fileName,
            file_path: fullPath,
            file_size: pdf.length,
            updated_at: new Date()
          }
        }
      );

      log.info(`✓ generate ok type=${opts.type} vessel=${data.vessel.name} pages~=${Math.round(pdf.length / 50000)} size=${(pdf.length / 1024).toFixed(0)}KB render=${tRender}ms total=${Date.now() - t0}ms file=${fileName}`);
      return { id: reportId, fileName, filePath: fullPath, fileSize: pdf.length, pdf };
    } catch (err) {
      log.error(`✗ generate failed type=${opts.type} vessel=${opts.vesselId} after=${Date.now() - t0}ms :: ${(err as Error).message}`);
      await db.collection('reports').updateOne(
        { _id: reportId },
        {
          $set: {
            status: 'failed',
            error_message: (err as Error).message,
            updated_at: new Date()
          }
        }
      ).catch(() => undefined);
      throw err;
    }
  },

  /** List historical reports for a vessel — used by the Quarterly
   *  Archive tab on the frontend. */
  async list(vesselId: string) {
    const db = getDb();
    const rows = await db.collection('reports')
      .find({ vessel_id: vesselId })
      .sort({ created_at: -1 })
      .toArray();

    return rows.map((row) => ({
      id: String(row._id),
      reportType: row.report_type,
      periodLabel: row.period_label,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      fileName: row.file_name,
      fileSize: row.file_size,
      generatedBy: row.generated_by,
      createdAt: row.created_at,
    }));
  },

  /** Quarterly Archive timeline. */
  async timeline(vesselId: string) {
    const db = getDb();
    const vessel = await db.collection('vessels').findOne({ _id: vesselId }, { projection: { created_at: 1 } });
    if (!vessel) {
      throw new Error('Vessel not found');
    }
    const onboardedAt = new Date(vessel.created_at);
    const periods = quartersSince(onboardedAt);

    // Pull all quarterly reports for this vessel and key by period_label
    const reports = await db.collection('reports')
      .find({ vessel_id: vesselId, report_type: 'quarterly' })
      .sort({ created_at: -1 })
      .toArray();

    const byLabel = new Map<string, any>();
    for (const row of reports) {
      if (!byLabel.has(row.period_label)) byLabel.set(row.period_label, row);
    }

    return periods.reverse().map((p) => {
      const r = byLabel.get(p.label);
      return {
        period: {
          label: p.label,
          start: p.start.toISOString(),
          end: p.end.toISOString(),
        },
        report: r
          ? {
              id: String(r._id),
              status: r.status,
              fileName: r.file_name,
              fileSize: r.file_size,
              generatedBy: r.generated_by,
              createdAt: r.created_at,
            }
          : null,
      };
    });
  },
};
