// -- Audit Controller (Pending Audits & Reviews) -----------
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import { AuditService } from '../services/audit.service.js';
import { DocumentService } from '../services/document.service.js';
import { sendMail } from '../services/email.service.js';
import jwt from 'jsonwebtoken';
import { persistUploadedFile, getStoredFileStream } from '../services/storage.service.js';
import { getDb } from '../config/database.js';
import { env } from '../config/env.js';
import { createError } from '../middleware/errorHandler.js';

// Canonical 20-column header used by the upload + review screens. If you add a
// column here, also update audit_line_items columns and the upload controller.
const LINE_ITEM_HEADER = [
  'Name', 'Vessel Name', 'PO Number', 'IMO Number',
  'PO Sent Date', 'MD Requested Date', 'Item Description', 'Is Suspected',
  'IMPA Code', 'ISSA Code', 'Equipment Code', 'Equipment Name',
  'Maker', 'Model', 'Part Number', 'Unit', 'Quantity',
  'Vendor Remark', 'Vendor Email', 'Vendor Name',
];

function lineItemRowToArray(row: Record<string, unknown>): unknown[] {
  const arr = [
    row.name, row.vesselName, row.poNumber, row.imoNumber,
    row.poSentDate, row.mdRequestedDate, row.itemDescription, row.isSuspected,
    row.impaCode, row.issaCode, row.equipmentCode, row.equipmentName,
    row.maker, row.model, row.partNumber, row.unit, row.quantity,
    row.vendorRemark, row.vendorEmail, row.vendorName,
  ].map((v) => (v == null ? '' : String(v)));
  const extra = (row.extraData as unknown[]) ?? [];
  if (Array.isArray(extra)) arr.push(...extra.map((v) => (v == null ? '' : String(v))));
  return arr;
}

/** GET /api/v1/audits/pending — Audits with status In Progress / Pending */
export async function getPendingAudits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audits = await AuditService.getPendingAudits(req.user!.userId);
    res.json({ success: true, data: audits, total: audits.length });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/active — Every audit not yet completed/reviewed.
 *  Drives the dashboard KPI counts. */
export async function getActiveAudits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audits = await AuditService.getActiveAudits(req.user!.userId);
    res.json({ success: true, data: audits, total: audits.length });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/reviews — Audits with status Pending Review */
export async function getPendingReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reviews = await AuditService.getPendingReviews(req.user!.userId);
    res.json({ success: true, data: reviews, total: reviews.length });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/:imo */
export async function getAuditDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audit = await AuditService.getAuditByImo(req.params.imo as string, req.user!.userId);
    if (!audit) return next(createError('Audit not found', 404));
    res.json({ success: true, data: audit });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/reviews/:imo */
export async function getReviewDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audit = await AuditService.getAuditByImo(req.params.imo as string, req.user!.userId);
    if (!audit) return next(createError('Review not found', 404));
    res.json({ success: true, data: audit });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/audits/:id/send-for-review */
export async function sendAuditForReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await AuditService.getAuditById(id, req.user!.userId);
    if (!existing) return next(createError('Audit not found', 404));

    const { assignedTo } = req.body as { assignedTo?: string };
    const updated = await AuditService.sendToReview(id, assignedTo);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/audits/reviews/:id/complete */
export async function completeReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await AuditService.getAuditById(id, req.user!.userId);
    if (!existing) return next(createError('Review not found', 404));

    const updated = await AuditService.completeReview(id, req.user!.email);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/audits/reviews/:id/reject */
export async function rejectReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await AuditService.getAuditById(id, req.user!.userId);
    if (!existing) return next(createError('Review not found', 404));

    const updated = await AuditService.rejectReview(id, req.user!.email);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/mds-doc — Suspected hazardous items pending MD/SDoC */
export async function getMdsDocAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // For now, use audits with hazmat materials pending - real query joins materials with category=hazard
    const audits = await AuditService.getAudits({ userId: req.user!.userId });
    res.json({ success: true, data: audits });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/:imo/documents */
export async function getAuditDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audit = await AuditService.getAuditByImo(req.params.imo as string, req.user!.userId);
    if (!audit) return next(createError('Audit not found', 404));

    const vesselId = (audit as Record<string, unknown>).vesselId as string;
    const docs = await DocumentService.getDocumentsForVessel(vesselId);
    res.json({ success: true, data: docs, imo: req.params.imo });
  } catch (err) { next(err); }
}

/** POST /api/v1/audits/:imo/documents */
export async function uploadAuditDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audit = await AuditService.getAuditByImo(req.params.imo as string, req.user!.userId);
    if (!audit) return next(createError('Audit not found', 404));
    if (!req.file) return next(createError('File required', 400));

    const vesselId = (audit as Record<string, unknown>).vesselId as string;
    const data = {
      name: req.body.name || req.file.originalname,
      documentType: req.body.documentType || 'Other',
      category: 'audit',
      status: 'pending',
      fileName: req.file.originalname,
      filePath: `/uploads/docs/${req.file.filename}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user!.email,
    };
    const doc = await DocumentService.createDocument(data, vesselId);
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
}

/**
 * Replace the template-generated "Suspected Items List:" block in the admin's
 * body with a per-vendor list so each recipient only sees their own POs. If
 * the admin removed the block, we append a fresh one instead.
 */
function rewriteSuspectedBlock(body: string, rows: unknown[][]): string {
  const list = rows.map((row, i) => {
    const r = Array.isArray(row) ? row : [];
    return `${i + 1}. PO: ${String(r[2] ?? '')} - ${String(r[6] ?? '')}`;
  }).join('\n');

  const START = 'Suspected Items List:\n';
  const endMarkers = [
    '\n\nPlease provide',
    '\n\nBest Regards',
    '\n\nBest regards',
    '\n\nRegards',
  ];

  const startIdx = body.indexOf(START);
  if (startIdx === -1) return `${body}\n\n${START}${list}`;

  const afterStart = startIdx + START.length;
  let endIdx = -1;
  for (const marker of endMarkers) {
    const idx = body.indexOf(marker, afterStart);
    if (idx !== -1 && (endIdx === -1 || idx < endIdx)) endIdx = idx;
  }
  if (endIdx === -1) endIdx = body.length;
  return body.slice(0, startIdx) + START + list + body.slice(endIdx);
}

/**
 * POST /api/v1/audits/clarification-email
 *
 * Split the outgoing clarification by vendor_email (column 18 of the
 * suspected_items rows) so each vendor gets a dedicated clarification
 * record, a dedicated public_token (and upload link), and a body that
 * only lists their own POs. This prevents two vendors on the same To
 * line from seeing each other's items when they open the link.
 */
export async function sendClarificationEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const db = getDb();
    const imo = req.body.imo as string | undefined;
    const vesselName = req.body.vesselName as string | undefined;
    const subject = req.body.subject as string | undefined;
    const body = req.body.body as string | undefined;

    const rawTo = req.body.to || req.body['to[]'];
    const rawCc = req.body.cc || req.body['cc[]'];
    const to = Array.isArray(rawTo) ? rawTo.map(String) : (typeof rawTo === 'string' ? [rawTo] : []);
    const cc = Array.isArray(rawCc) ? rawCc.map(String) : (typeof rawCc === 'string' ? [rawCc] : []);

    let suspectedItems = req.body.suspectedItems;
    if (typeof suspectedItems === 'string') {
      try {
        suspectedItems = JSON.parse(suspectedItems);
      } catch {
        suspectedItems = [];
      }
    }

    if (!imo || to.length === 0 || !subject || !body) {
      return next(createError('imo, to, subject, and body are required', 400));
    }

    const audit = await AuditService.getAuditByImo(imo, req.user!.userId);
    const vesselId = audit ? (audit as Record<string, unknown>).vesselId as string : null;

    // --- Split suspected items per vendor_email (row index 18). ------------
    const rowsIn: unknown[][] = Array.isArray(suspectedItems)
      ? (suspectedItems as unknown[][]).filter((r) => Array.isArray(r))
      : [];

    const lcTo = new Set(
      to.map((e) => String(e).trim().toLowerCase()).filter(Boolean),
    );

    // canonical casing preserved from the admin's input
    const canonicalByLc = new Map<string, string>();
    for (const entry of to) {
      const raw = String(entry).trim();
      if (!raw) continue;
      canonicalByLc.set(raw.toLowerCase(), raw);
    }

    const byVendor = new Map<string, unknown[][]>();
    const orphanRows: unknown[][] = [];
    for (const row of rowsIn) {
      const vendorEmail = String(row[18] ?? '').trim().toLowerCase();
      if (vendorEmail && lcTo.has(vendorEmail)) {
        if (!byVendor.has(vendorEmail)) byVendor.set(vendorEmail, []);
        byVendor.get(vendorEmail)!.push(row);
      } else {
        orphanRows.push(row);
      }
    }

    // Admin-typed addresses that aren't the vendor_email on any suspected
    // row. Two roles:
    //   - If there are orphan rows (items with unknown vendor_email), the
    //     extras become the To for that orphan batch.
    //   - Regardless, they're Bcc'd on every per-vendor batch so a reviewer
    //     / admin who's CC'd-in-spirit still gets a copy of the outreach.
    const extrasLc = Array.from(lcTo).filter((e) => !byVendor.has(e));
    const canonicalExtras = extrasLc.map((e) => canonicalByLc.get(e) ?? e);

    type Batch = { to: string[]; bcc?: string[]; rows: unknown[][]; isOrphan?: boolean };
    const batches: Batch[] = [];
    for (const [vendorLc, rows] of byVendor.entries()) {
      const canonical = canonicalByLc.get(vendorLc) ?? vendorLc;
      batches.push({
        to: [canonical],
        // Extras ride as Bcc so the admin/reviewer gets a copy without
        // leaking to the vendor and without being shown other Bcc addresses.
        bcc: canonicalExtras.length > 0 ? canonicalExtras : undefined,
        rows,
      });
    }
    if (orphanRows.length > 0 && canonicalExtras.length > 0) {
      batches.push({ to: canonicalExtras, rows: orphanRows, isOrphan: true });
    }
    if (batches.length === 0) {
      return next(createError(
        'No outgoing mail: none of the suspected items match the recipients in To.',
        400,
      ));
    }

    // --- Persist DB rows synchronously, then dispatch SMTP in the background.
    //
    // Why: per-vendor split + Gmail SMTP can take minutes for a large
    // recipient list, and Render-class hosting kills HTTP requests after
    // ~30s. So we do all the database work up-front (fast), respond 200,
    // then fire the SMTP sends without awaiting. Each clarification_requests
    // row's status is patched to 'sent' / 'failed' as the dispatch completes.

    type Persisted = {
      clarificationId: string;
      publicToken: string;
      bodyWithLink: string;
      html: string;
      to: string[];
      bcc?: string[];
      itemCount: number;
    };

    const persisted: Persisted[] = [];

    for (const batch of batches) {
      const publicToken = crypto.randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const supplierLink = `${env.APP_BASE_URL.replace(/\/$/, '')}/upload/${publicToken}`;
      const expiresText = expiresAt.toISOString().replace('T', ' ').replace(/\..+/, ' UTC');

      const perVendorBody = rewriteSuspectedBlock(body, batch.rows);
      const bodyWithLink = `${perVendorBody}\n\n---\nUpload documents directly via this secure link (no login required):\n${supplierLink}\n\nThis link expires on ${expiresText} (72 hours from now).`;
      const html = bodyWithLink
        .split('\n')
        .map((line) => {
          const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          if (line.trim() === supplierLink) {
            return `<div><a href="${supplierLink}" style="color:#00B0FA;font-weight:600">${supplierLink}</a></div>`;
          }
          return `<div>${escaped || '&nbsp;'}</div>`;
        })
        .join('');

      const ccAndBcc: string[] = [];
      if (cc && cc.length) ccAndBcc.push(...cc);
      if (batch.bcc && batch.bcc.length) ccAndBcc.push(...batch.bcc);

      const db = getDb();
      const clarId = crypto.randomUUID();
      await db.collection('clarification_requests').insertOne({
        _id: clarId,
        vessel_id: vesselId,
        imo_number: imo,
        vessel_name: vesselName || null,
        recipient_emails: batch.to.join(', '),
        cc_emails: ccAndBcc.length > 0 ? ccAndBcc.join(', ') : null,
        subject,
        body: bodyWithLink,
        suspected_items: batch.rows,
        status: 'queued',
        error_message: null,
        sent_by: req.user!.userId,
        public_token: publicToken,
        public_token_expires_at: expiresAt,
        created_at: new Date(),
        updated_at: new Date()
      });
      const clarificationId = clarId;

      const itemCount = batch.rows.length;
      if (itemCount > 0) {
        const docs = [];
        for (let i = 0; i < itemCount; i++) {
          docs.push({
            _id: crypto.randomUUID(),
            clarification_id: clarificationId,
            item_index: i,
            mds_status: 'pending',
            sdoc_status: 'pending',
            reminder_count: 0,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
        try {
          await db.collection('clarification_items').insertMany(docs, { ordered: false });
        } catch (err: any) {
          if (!err.message.includes('E11000')) {
            throw err;
          }
        }
      }

      persisted.push({
        clarificationId,
        publicToken,
        bodyWithLink,
        html,
        to: batch.to,
        bcc: batch.bcc,
        itemCount,
      });
    }

    // Move the audit into 'Awaiting Clarification' immediately
    if (audit) {
      const auditRow = audit as Record<string, unknown>;
      const currentStatus = String(auditRow.status ?? '');
      if (currentStatus === 'Pending Review' || currentStatus === 'In Progress' || currentStatus === 'Pending') {
        await db.collection('audit_summaries').updateOne(
          { _id: auditRow.id },
          {
            $set: {
              status: 'Awaiting Clarification',
              last_activity: new Date(),
              updated_at: new Date()
            }
          }
        );
      }
    }

    // Respond IMMEDIATELY so the platform's HTTP timeout never fires.
    res.json({
      success: true,
      data: {
        batches: persisted.map((p) => ({
          clarificationId: p.clarificationId,
          to: p.to,
          itemCount: p.itemCount,
          status: 'queued',
        })),
      },
    });

    // Fire-and-forget the SMTP sends in parallel. Each completion patches
    // its clarification_requests row to 'sent' or 'failed'. Verbose logs
    // so the operator can confirm in the host logs that the dispatch
    // actually ran.
    console.info(
      `[Clarification Email] Queued ${persisted.length} batch(es) for IMO ${imo}`,
    );

    const attachments = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[]).map((f) => ({
          filename: f.originalname,
          path: f.path,
        }))
      : [];

    void Promise.allSettled(
      persisted.map(async (p) => {
        const label = `[Clarification Email] ${p.clarificationId} -> ${p.to.join(', ')}`;
        const t0 = Date.now();
        try {
          const result = await sendMail({
            to: p.to,
            cc,
            bcc: p.bcc,
            subject,
            text: p.bodyWithLink,
            html: p.html,
            attachments,
          });
          const elapsed = Date.now() - t0;
          console.info(
            `${label}: Sent OK (${elapsed}ms) messageId=${(result as { messageId?: string })?.messageId ?? '?'}`,
          );
          await db.collection('clarification_requests').updateOne(
            { _id: p.clarificationId },
            { $set: { status: 'sent', error_message: null, updated_at: new Date() } }
          );
        } catch (mailErr) {
          const errorMessage = mailErr instanceof Error ? mailErr.message : 'Unknown mail error';
          const elapsed = Date.now() - t0;
          console.error(`${label}: Failed after ${elapsed}ms - ${errorMessage}`);
          await db.collection('clarification_requests').updateOne(
            { _id: p.clarificationId },
            { $set: { status: 'failed', error_message: errorMessage, updated_at: new Date() } }
          ).catch((dbErr: any) => {
            console.error(`${label}: Failed to update status in DB:`, dbErr);
          });
        }
      }),
    ).then(() => {
      for (const f of attachments) {
        fs.unlink(f.path, (err: NodeJS.ErrnoException | null) => {
          if (err) console.error(`[Clarification Email] Failed to delete temp file ${f.path}:`, err);
        });
      }
    });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/:imo/line-items — rows for the review/edit grid.
 *  Picks an arbitrary audit if the IMO has duplicates; prefer by-id for
 *  pages that already know the audit UUID.
 */
export async function getAuditLineItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audit = await AuditService.getAuditByImo(req.params.imo as string, req.user!.userId);
    if (!audit) return next(createError('Audit not found', 404));

    const auditId = String((audit as Record<string, unknown>).id);
    const dbRows = await AuditService.getLineItems(auditId);
    const rows = dbRows.map(lineItemRowToArray);

    res.json({
      success: true,
      data: {
        auditId,
        imo: req.params.imo,
        header: LINE_ITEM_HEADER,
        rows,
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/by-id/:auditId/line-items — exact audit, no IMO ambiguity */
export async function getAuditLineItemsById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auditId = req.params.auditId as string;
    const audit = await AuditService.getAuditById(auditId, req.user!.userId);
    if (!audit) return next(createError('Audit not found', 404));

    const a = audit as Record<string, unknown>;
    const dbRows = await AuditService.getLineItems(auditId);
    const rows = dbRows.map(lineItemRowToArray);

    res.json({
      success: true,
      data: {
        auditId,
        imo: a.imoNumber,
        header: LINE_ITEM_HEADER,
        rows,
      },
    });
  } catch (err) { next(err); }
}

/**
 * PATCH /api/v1/audits/:imo/line-items — replace all rows for the audit
 * matching this IMO (picks arbitrary one if multiple exist). Prefer the
 * by-id variant below when the caller has the audit UUID.
 */
export async function replaceAuditLineItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audit = await AuditService.getAuditByImo(req.params.imo as string, req.user!.userId);
    if (!audit) return next(createError('Audit not found', 404));

    const { rows } = req.body as { rows?: unknown[][] };
    if (!Array.isArray(rows)) {
      return next(createError('rows must be an array of row arrays', 400));
    }

    const auditRow = audit as Record<string, unknown>;
    const auditId = String(auditRow.id);
    const vesselId = auditRow.vesselId ? String(auditRow.vesselId) : null;

    await AuditService.replaceLineItems(auditId, vesselId, rows);
    const db = getDb();
    await db.collection('audit_summaries').updateOne(
      { _id: auditId },
      {
        $set: {
          total_items: rows.length,
          last_activity: new Date(),
          updated_at: new Date()
        }
      }
    );

    res.json({ success: true, data: { auditId, rowsWritten: rows.length } });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/audits/by-id/:auditId/line-items — exact audit, no IMO ambiguity */
export async function replaceAuditLineItemsById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auditId = req.params.auditId as string;
    const audit = await AuditService.getAuditById(auditId, req.user!.userId);
    if (!audit) return next(createError('Audit not found', 404));

    const { rows } = req.body as { rows?: unknown[][] };
    if (!Array.isArray(rows)) {
      return next(createError('rows must be an array of row arrays', 400));
    }

    const a = audit as Record<string, unknown>;
    const vesselId = a.vesselId ? String(a.vesselId) : null;

    await AuditService.replaceLineItems(auditId, vesselId, rows);
    const db = getDb();
    await db.collection('audit_summaries').updateOne(
      { _id: auditId },
      {
        $set: {
          total_items: rows.length,
          last_activity: new Date(),
          updated_at: new Date()
        }
      }
    );

    res.json({ success: true, data: { auditId, rowsWritten: rows.length } });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/mds-pending — aggregate view for the MD SDoC Audit Pending page */
export async function getMdsPendingOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await AuditService.getMdsPendingOverview(req.user!.userId);
    const data = rows.map((r) => {
      const pendingMds = Number(r.pending_mds ?? 0);
      const submitted = Boolean(r.any_submitted);
      return {
        imoNumber: String(r.imo_number ?? ''),
        vesselName: String(r.vessel_name ?? ''),
        totalPOs: Number(r.total_po ?? 0),
        pendingMDS: pendingMds,
        pendingSdocs: pendingMds, // same until we track MD and SDoC separately
        receivedMDS: Number(r.received_mds ?? 0),
        clarificationCount: Number(r.clarification_count ?? 0),
        clarificationStatus: pendingMds === 0 && submitted ? 'Resolved' : 'Awaiting Clarification',
        lastSubmissionDate: r.last_submitted_at
          ? String(r.last_submitted_at).split('T')[0]
          : (r.last_received_at ? String(r.last_received_at).split('T')[0] : ''),
      };
    });
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/vessels/:vesselId/po-items — all line items for the vessel's active audit, with clarification state */
export async function getVesselPoItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const result = await AuditService.getVesselPoItems(vesselId, req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

/** GET /api/v1/audits/:imo/clarifications — clarifications sent for an audit */
export async function getAuditClarifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const audit = await AuditService.getAuditByImo(req.params.imo as string, req.user!.userId);
    if (!audit) return next(createError('Audit not found', 404));

    const rows = await AuditService.getClarificationsForImo(req.params.imo as string);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/audits/clarifications/:clarId/items/:idx/document — upload the
 * vendor's MD/SDoC reply for a specific suspected item. Stores the file and
 * marks the item as 'received'.
 */
export async function uploadClarificationItemDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) return next(createError('File required', 400));

    const clarificationId = req.params.clarId as string;
    const itemIndex = Number(req.params.idx);
    if (!Number.isFinite(itemIndex) || itemIndex < 0) {
      return next(createError('Invalid item index', 400));
    }
    const rawKind = String(req.params.kind ?? '').trim().toLowerCase();
    const kind: 'md' | 'sdoc' | null =
      rawKind === 'md' || rawKind === 'mds' ? 'md'
      : rawKind === 'sdoc' || rawKind === 'sdocs' ? 'sdoc'
      : null;
    if (!kind) return next(createError("Invalid document kind. Expected 'md' or 'sdoc'.", 400));

    const item = await AuditService.getClarificationItem(clarificationId, itemIndex);
    if (!item) return next(createError('Clarification item not found', 404));

    // Verify user owns the vessel this clarification belongs to.
    const imo = String(item.imo_number);
    const parent = await AuditService.getAuditByImo(imo, req.user!.userId);
    if (!parent) return next(createError('Audit not found for this user', 404));

    const stored = await persistUploadedFile(req.file.path, req.file.originalname, kind);
    const updated = await AuditService.setClarificationItemDocument(
      clarificationId,
      itemIndex,
      kind,
      stored.url,
      stored.name,
    );

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/audits/clarifications/:clarId/items/:idx/remind
 * Re-send the clarification email as a reminder for one item. Optional body:
 *   { subject?, body?, to?, cc? }  — overrides for the outgoing mail.
 * Reuses the existing public_token (so the supplier's link stays the same)
 * and extends its expiry by 72 hours. Increments reminder_count on the item.
 */
export async function sendClarificationItemReminder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const clarificationId = req.params.clarId as string;
    const itemIndex = Number(req.params.idx);
    if (!Number.isFinite(itemIndex) || itemIndex < 0) {
      return next(createError('Invalid item index', 400));
    }

    const clar = await AuditService.getClarificationForReminder(clarificationId, itemIndex);
    if (!clar) return next(createError('Clarification item not found', 404));

    // Ownership via the parent audit or clarification request
    const db = getDb();
    const owned = await AuditService.getAuditByImo(String(clar.imo_number), req.user!.userId);
    if (!owned) {
      const clarReq = await db.collection('clarification_requests').findOne({ _id: clarificationId });
      if (!clarReq) return next(createError('Audit not found for this user', 404));
    }

    const overrides = (req.body || {}) as {
      subject?: string;
      body?: string;
      to?: string | string[];
      cc?: string | string[];
    };

    const parseList = (v: string | string[] | undefined): string[] => {
      if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
      if (typeof v === 'string') return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      return [];
    };

    const toOverride = parseList(overrides.to);
    const ccOverride = parseList(overrides.cc);
    const toField = toOverride.length > 0
      ? toOverride
      : parseList(String(clar.recipient_emails || ''));
    const ccField = ccOverride.length > 0
      ? ccOverride
      : parseList(clar.cc_emails ? String(clar.cc_emails) : '');

    if (toField.length === 0) {
      return next(createError('No recipient email available for reminder', 400));
    }

    const supplierLink = `${env.APP_BASE_URL.replace(/\/$/, '')}/upload/${clar.public_token}`;
    const newExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const expiresText = newExpiresAt.toISOString().replace('T', ' ').replace(/\..+/, ' UTC');

    const subjectLine = overrides.subject?.trim()
      || `Reminder: ${clar.subject || 'Documentation required'}`;
    const bodyBase = overrides.body?.trim()
      || `This is a reminder regarding our earlier request. We still need the MDS / SDoC documents for vessel ${clar.vessel_name || clar.imo_number}.`;
    const bodyWithLink = `${bodyBase}\n\n---\nUpload documents directly via this secure link (no login required):\n${supplierLink}\n\nThis link expires on ${expiresText} (72 hours from now).`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">EnviGuide IHM Compliance Reminder</h2>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${bodyBase}</p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${supplierLink}" style="background-color: #00B0FA; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 176, 250, 0.2)">Upload IHM Documents</a>
        </div>
        <p style="color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 0;">
          This secure link does not require a login. It will expire on ${expiresText} (72 hours from now).
        </p>
      </div>
    `;

    try {
      await sendMail({
        to: toField,
        cc: ccField.length > 0 ? ccField : undefined,
        subject: subjectLine,
        text: bodyWithLink,
        html,
      });
    } catch (mailErr) {
      const msg = mailErr instanceof Error ? mailErr.message : 'Mail delivery failed';
      console.error(`[sendMail Error] Delivery failed: ${msg}`);
      return next(createError(`Email send failed: ${msg}`, 400));
    }

    const updated = await AuditService.incrementReminderAndExtendToken(
      clarificationId,
      itemIndex,
      newExpiresAt,
    );

    res.json({
      success: true,
      data: {
        reminderCount: updated?.reminder_count ?? null,
        sentTo: toField,
        publicLink: supplierLink,
        expiresAt: newExpiresAt,
      },
    });
  } catch (err) { next(err); }
}

/** Validate kind path-param. Accepts 'md' / 'mds' / 'sdoc' / 'sdocs'. */
function parseDocKind(raw: unknown): 'md' | 'sdoc' | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'md' || v === 'mds') return 'md';
  if (v === 'sdoc' || v === 'sdocs') return 'sdoc';
  return null;
}

interface PreviewTokenPayload {
  type: 'doc-preview';
  clarId: string;
  idx: number;
  kind: 'md' | 'sdoc';
}

/**
 * POST /api/v1/audits/clarifications/:clarId/remind-bulk
 *
 * Sends ONE reminder email for the clarification (= one vendor) and bumps
 * reminder_count on every item_index in the request body. Used by the PO
 * viewer's bulk-select toolbar — the admin selects N rows, the frontend
 * groups them by clarification_id, and fires this endpoint per group so
 * each vendor gets a single email regardless of how many of their items
 * are pending.
 *
 * Body: { itemIndices: number[], to?: string|string[], cc?: string|string[],
 *         subject?: string, body?: string }
 */
export async function sendClarificationBulkReminder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const clarificationId = req.params.clarId as string;
    const body = (req.body || {}) as {
      itemIndices?: number[];
      to?: string | string[];
      cc?: string | string[];
      subject?: string;
      body?: string;
    };

    const itemIndices: number[] = Array.isArray(body.itemIndices)
      ? body.itemIndices.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0)
      : [];
    if (itemIndices.length === 0) {
      return next(createError('itemIndices must be a non-empty array of integers', 400));
    }

    const clar = await AuditService.getClarificationById(clarificationId);
    if (!clar) return next(createError('Clarification not found', 404));

    const owned = await AuditService.getAuditByImo(String(clar.imo_number), req.user!.userId);
    if (!owned) return next(createError('Audit not found for this user', 404));

    const parseList = (v: string | string[] | undefined): string[] => {
      if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
      if (typeof v === 'string') return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      return [];
    };

    const toOverride = parseList(body.to);
    const ccOverride = parseList(body.cc);
    const toField = toOverride.length > 0
      ? toOverride
      : parseList(String(clar.recipient_emails || ''));
    const ccField = ccOverride.length > 0
      ? ccOverride
      : parseList(clar.cc_emails ? String(clar.cc_emails) : '');

    if (toField.length === 0) {
      return next(createError('No recipient email available for reminder', 400));
    }

    const supplierLink = `${env.APP_BASE_URL.replace(/\/$/, '')}/upload/${clar.public_token}`;
    const newExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const expiresText = newExpiresAt.toISOString().replace('T', ' ').replace(/\..+/, ' UTC');

    const subjectLine = body.subject?.trim()
      || `Reminder: ${clar.subject || 'Documentation required'}`;
    const bodyBase = body.body?.trim()
      || `This is a reminder regarding our earlier request. We still need the MDS / SDoC documents for vessel ${clar.vessel_name || clar.imo_number}. ${itemIndices.length} item(s) are still outstanding.`;
    const bodyWithLink = `${bodyBase}\n\n---\nUpload documents directly via this secure link (no login required):\n${supplierLink}\n\nThis link expires on ${expiresText} (72 hours from now).`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">EnviGuide IHM Compliance Reminder</h2>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${bodyBase}</p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${supplierLink}" style="background-color: #00B0FA; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 176, 250, 0.2)">Upload IHM Documents</a>
        </div>
        <p style="color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 0;">
          This secure link does not require a login. It will expire on ${expiresText} (72 hours from now).
        </p>
      </div>
    `;

    let mailWarning: string | null = null;
    try {
      await sendMail({
        to: toField,
        cc: ccField.length > 0 ? ccField : undefined,
        subject: subjectLine,
        text: bodyWithLink,
        html,
      });
    } catch (mailErr) {
      mailWarning = mailErr instanceof Error ? mailErr.message : 'Unknown mail error';
      console.warn(`[sendMail warning] Mail delivery failed: ${mailWarning}`);
    }

    const updatedRows = await AuditService.incrementRemindersAndExtendToken(
      clarificationId,
      itemIndices,
      newExpiresAt,
    );

    res.json({
      success: true,
      mailWarning,
      data: {
        clarificationId,
        itemCount: itemIndices.length,
        sentTo: toField,
        publicLink: supplierLink,
        expiresAt: newExpiresAt,
        updated: updatedRows,
      },
    });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/audits/clarifications/:clarId/items/:idx/document/:kind/preview-url
 *
 * Returns a relative proxy URL the admin can drop into an iframe. The URL
 * carries a 5-minute JWT-signed token; when the iframe fetches it, the
 * /preview-stream handler validates the token, fetches the file from S3,
 * and re-emits it with Content-Type: application/pdf (etc.) and
 * Content-Disposition: inline. Going through our backend gives us full
 * control over response headers — Supabase's public URL ignores the
 * disposition override on its own.
 */
export async function getDocumentPreviewUrl(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const clarificationId = req.params.clarId as string;
    const itemIndex = Number(req.params.idx);
    if (!Number.isFinite(itemIndex) || itemIndex < 0) {
      return next(createError('Invalid item index', 400));
    }
    const kind = parseDocKind(req.params.kind);
    if (!kind) return next(createError("Invalid document kind. Expected 'md' or 'sdoc'.", 400));

    const item = await AuditService.getClarificationItem(clarificationId, itemIndex);
    if (!item) return next(createError('Clarification item not found', 404));

    const parent = await AuditService.getAuditByImo(String(item.imo_number), req.user!.userId);
    if (!parent) return next(createError('Audit not found for this user', 404));

    const filePath = kind === 'sdoc' ? item.sdoc_file_path : item.mds_file_path;
    const fileName = kind === 'sdoc' ? item.sdoc_file_name : item.mds_file_name;
    if (!filePath) return next(createError('Document not uploaded yet', 404));

    const payload: PreviewTokenPayload = {
      type: 'doc-preview',
      clarId: clarificationId,
      idx: itemIndex,
      kind,
    };
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '5m' });

    // Relative URL — frontend prefixes API_CONFIG.BASE_URL when assigning
    // it to the iframe. Token in the query string is acceptable here: it
    // only authorises a single read of one specific file, expires in 5 min,
    // and never leaks back to the client logger.
    const url = `/audits/clarifications/${clarificationId}/items/${itemIndex}/document/${kind}/preview-stream?t=${encodeURIComponent(token)}`;

    res.json({
      success: true,
      data: { url, fileName: fileName ? String(fileName) : 'document' },
    });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/audits/clarifications/:clarId/items/:idx/document/:kind/preview-stream?t=<token>
 *
 * Re-streams the requested file with Content-Disposition: inline so iframe
 * previews work even when the underlying bucket forces 'attachment'. Reads
 * the file from S3 (Supabase) and pipes the body directly to the response;
 * no buffering of the whole document. Token must be a 'doc-preview' JWT
 * issued by getDocumentPreviewUrl above.
 */
export async function streamDocumentPreview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = String(req.query.t ?? '');
    if (!token) return next(createError('Preview token required', 401));

    let payload: PreviewTokenPayload;
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      payload = decoded as PreviewTokenPayload;
    } catch {
      return next(createError('Preview token expired or invalid', 401));
    }
    if (payload.type !== 'doc-preview') {
      return next(createError('Wrong token type', 401));
    }

    // Path-params must agree with the token's payload — prevents reusing a
    // token issued for a different file.
    const urlClarId = req.params.clarId as string;
    const urlIdx = Number(req.params.idx);
    const urlKind = parseDocKind(req.params.kind);
    if (urlClarId !== payload.clarId || urlIdx !== payload.idx || urlKind !== payload.kind) {
      return next(createError('Token does not match request', 401));
    }

    const item = await AuditService.getClarificationItem(payload.clarId, payload.idx);
    if (!item) return next(createError('Clarification item not found', 404));

    const filePath = payload.kind === 'sdoc' ? item.sdoc_file_path : item.mds_file_path;
    const fileName = payload.kind === 'sdoc' ? item.sdoc_file_name : item.mds_file_name;
    if (!filePath) return next(createError('Document not uploaded yet', 404));

    const stream = await getStoredFileStream(String(filePath));
    if (!stream) {
      // Local-disk dev fallback: the file lives under /uploads/* and is
      // served inline by express's static handler. Just redirect.
      return res.redirect(String(filePath));
    }

    res.setHeader('Content-Type', stream.contentType);
    const safeName = String(fileName ?? 'document').replace(/"/g, '');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    if (stream.contentLength) res.setHeader('Content-Length', String(stream.contentLength));
    res.setHeader('Cache-Control', 'private, max-age=60');

    stream.body.pipe(res);
    stream.body.on('error', (err) => {
      console.error('[preview-stream] upstream error:', err);
      // Headers already sent — just destroy the response.
      res.destroy();
    });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/audits/clarifications/:clarId/items/:idx/review
 * Marks a clarification item as reviewed by the admin. Sets reviewed_at = NOW()
 * and stores the reviewer's email/userId. The PO viewer's 'Reviewed Mds'
 * filter pill keys off this column.
 */
export async function markClarificationItemReviewed(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const clarificationId = req.params.clarId as string;
    const itemIndex = Number(req.params.idx);
    if (!Number.isFinite(itemIndex) || itemIndex < 0) {
      return next(createError('Invalid item index', 400));
    }

    const item = await AuditService.getClarificationItem(clarificationId, itemIndex);
    if (!item) return next(createError('Clarification item not found', 404));

    // Verify user owns the vessel this clarification belongs to.
    const imo = String(item.imo_number);
    const parent = await AuditService.getAuditByImo(imo, req.user!.userId);
    if (!parent) return next(createError('Audit not found for this user', 404));

    const reviewedBy = req.user!.email || req.user!.userId;
    const updated = await AuditService.markClarificationItemReviewed(
      clarificationId,
      itemIndex,
      reviewedBy,
    );

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/audits/:id — hard-delete an audit and its line items */
export async function deleteAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await AuditService.getAuditById(id, req.user!.userId);
    if (!existing) return next(createError('Audit not found', 404));

    // FK on audit_line_items has ON DELETE CASCADE, so they go with the audit.
    await AuditService.deleteAudit(id);
    res.json({ success: true, data: { id } });
  } catch (err) { next(err); }
}

/** PUT /api/v1/audits/line-items/:id — update a single line item */
export async function updateAuditLineItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const db = getDb();
    const item = await db.collection('audit_line_items').findOne({ _id: id });
    if (!item) return next(createError('Line item not found', 404));

    const audit = await AuditService.getAuditById(String(item.audit_id), req.user!.userId);
    if (!audit) return next(createError('Unauthorized to update this line item', 403));

    const body = req.body as Record<string, unknown>;
    const updateFields: Record<string, unknown> = {};

    const camelToSnakeMap: Record<string, string> = {
      poNumber: 'po_number',
      itemDescription: 'item_description',
      isSuspected: 'is_suspected',
      impaCode: 'impa_code',
      issaCode: 'issa_code',
      equipmentCode: 'equipment_code',
      equipmentName: 'equipment_name',
      maker: 'maker',
      model: 'model',
      partNumber: 'part_number',
      unit: 'unit',
      quantity: 'quantity',
      vendorRemark: 'vendor_remark',
      vendorEmail: 'vendor_email',
      vendorName: 'vendor_name'
    };

    for (const [camel, snake] of Object.entries(camelToSnakeMap)) {
      if (camel in body) {
        if (camel === 'isSuspected') {
          updateFields[snake] = body[camel] === true || String(body[camel]).toLowerCase() === 'yes' ? 'Yes' : 'No';
        } else {
          updateFields[snake] = body[camel];
        }
      }
    }

    updateFields.updated_at = new Date();

    await db.collection('audit_line_items').updateOne({ _id: id }, { $set: updateFields });
    const updated = await db.collection('audit_line_items').findOne({ _id: id });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/audits/line-items/:id — delete a single line item */
export async function deleteAuditLineItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const db = getDb();
    const item = await db.collection('audit_line_items').findOne({ _id: id });
    if (!item) return next(createError('Line item not found', 404));

    const audit = await AuditService.getAuditById(String(item.audit_id), req.user!.userId);
    if (!audit) return next(createError('Unauthorized to delete this line item', 403));

    await db.collection('audit_line_items').deleteOne({ _id: id });

    await db.collection('audit_summaries').updateOne(
      { _id: item.audit_id },
      { $inc: { total_items: -1 }, $set: { last_activity: new Date() } }
    );

    res.status(204).send();
  } catch (err) { next(err); }
}
