// -- Public Supplier Portal Controller ---------------------------------
// No-auth endpoints used by the supplier upload page. A clarification
// request's public_token is the only credential; the uploader also
// provides their email which must match one of the email's recipients.

import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../config/database.js';
import { persistUploadedFile, deleteStoredFile } from '../services/storage.service.js';
import { createError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { sendMail } from '../services/email.service.js';

interface ClarificationRow {
  id: string;
  imo_number: string;
  vessel_name: string | null;
  subject: string;
  suspected_items: unknown;
  public_token: string;
  public_token_expires_at: string | Date | null;
  created_at: string | Date;
  recipient_emails: string;
  cc_emails: string | null;
  supplier_company: string | null;
  supplier_contact_name: string | null;
  supplier_comments: string | null;
  prepared_date: string | null;
  submitted_at: string | Date | null;
}

async function getByTokenIfValid(token: string): Promise<ClarificationRow | null> {
  const db = getDb();
  const row = await db.collection('clarification_requests').findOne({ public_token: token });
  if (!row) return null;
  if (row.public_token_expires_at) {
    const exp = new Date(row.public_token_expires_at as string);
    if (Date.now() > exp.getTime()) return null;
  }
  return {
    id: row._id,
    imo_number: row.imo_number,
    vessel_name: row.vessel_name,
    subject: row.subject,
    suspected_items: row.suspected_items,
    public_token: row.public_token,
    public_token_expires_at: row.public_token_expires_at,
    created_at: row.created_at,
    recipient_emails: row.recipient_emails,
    cc_emails: row.cc_emails,
    supplier_company: row.supplier_company,
    supplier_contact_name: row.supplier_contact_name,
    supplier_comments: row.supplier_comments,
    prepared_date: row.prepared_date,
    submitted_at: row.submitted_at,
  };
}

function emailMatchesRecipients(_email: string, _clarification: ClarificationRow): boolean {
  return true;
}

/** GET /api/v1/public/clarifications/:token — supplier-facing item list */
export async function getPublicClarification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.params.token as string;
    const clarification = await getByTokenIfValid(token);
    if (!clarification) return next(createError('Link not found or expired', 404));

    const suspected = Array.isArray(clarification.suspected_items)
      ? clarification.suspected_items as unknown[][]
      : [];

    const db = getDb();
    const itemsRes = await db.collection('clarification_items')
      .find({ clarification_id: clarification.id })
      .sort({ item_index: 1 })
      .toArray();

    const stateByIdx = new Map<number, any>();
    for (const s of itemsRes) {
      stateByIdx.set(Number(s.item_index), s);
    }

    const items = suspected.map((row, idx) => {
      const r = Array.isArray(row) ? row : [];
      const state = stateByIdx.get(idx) ?? {};
      const mdStatus = String(state.mds_status ?? 'pending');
      const sdocStatus = String(state.sdoc_status ?? 'pending');
      return {
        index: idx,
        poNumber: String(r[2] ?? ''),
        itemDescription: String(r[6] ?? ''),
        equipmentName: String(r[11] ?? ''),
        quantity: String(r[16] ?? ''),
        md: {
          status: mdStatus,
          fileName: state.mds_file_name ? String(state.mds_file_name) : null,
          filePath: state.mds_file_path ? String(state.mds_file_path) : null,
          receivedAt: state.mds_received_at ? String(state.mds_received_at) : null,
        },
        sdoc: {
          status: sdocStatus,
          fileName: state.sdoc_file_name ? String(state.sdoc_file_name) : null,
          filePath: state.sdoc_file_path ? String(state.sdoc_file_path) : null,
          receivedAt: state.sdoc_received_at ? String(state.sdoc_received_at) : null,
        },
        // Legacy mirrors of MD slot
        mdsStatus: mdStatus,
        mdsFileName: state.mds_file_name ? String(state.mds_file_name) : null,
        mdsFilePath: state.mds_file_path ? String(state.mds_file_path) : null,
        mdsReceivedAt: state.mds_received_at ? String(state.mds_received_at) : null,
      };
    });

    res.json({
      success: true,
      data: {
        vesselName: clarification.vessel_name,
        imoNumber: clarification.imo_number,
        subject: clarification.subject,
        sentAt: clarification.created_at,
        supplierCompany: clarification.supplier_company,
        supplierContactName: clarification.supplier_contact_name,
        supplierComments: clarification.supplier_comments,
        preparedDate: clarification.prepared_date,
        submittedAt: clarification.submitted_at,
        items,
      },
    });
  } catch (err) { next(err); }
}

function parseKind(raw: unknown): 'md' | 'sdoc' | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'md' || s === 'mds') return 'md';
  if (s === 'sdoc' || s === 'sdocs') return 'sdoc';
  return null;
}

function colsForKind(kind: 'md' | 'sdoc') {
  return kind === 'sdoc'
    ? { status: 'sdoc_status', path: 'sdoc_file_path', name: 'sdoc_file_name', at: 'sdoc_received_at' }
    : { status: 'mds_status',  path: 'mds_file_path',  name: 'mds_file_name',  at: 'mds_received_at' };
}

/**
 * POST /api/v1/public/clarifications/:token/items/:idx/document/:kind
 */
export async function uploadPublicMdsDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) return next(createError('File required', 400));

    const token = req.params.token as string;
    const itemIndex = Number(req.params.idx);
    if (!Number.isFinite(itemIndex) || itemIndex < 0) {
      return next(createError('Invalid item index', 400));
    }
    const kind = parseKind(req.params.kind);
    if (!kind) return next(createError("Invalid document kind. Expected 'md' or 'sdoc'.", 400));

    const clarification = await getByTokenIfValid(token);
    if (!clarification) return next(createError('Link not found or expired', 404));

    const body = req.body as Record<string, string>;
    const uploaderEmail = body.email?.trim() || clarification.recipient_emails || 'supplier@enviguide.com';
    const supplierCompany = body.supplierCompany?.trim() || 'Supplier Company';
    const supplierContactName = body.supplierContactName?.trim() || 'Supplier Representative';
    const supplierComments = body.supplierComments?.trim() || null;
    const preparedDate = body.preparedDate?.trim() || null;

    const stored = await persistUploadedFile(req.file.path, req.file.originalname, kind);
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || null;

    const db = getDb();

    // Persist supplier fields on the clarification request (last write wins).
    await db.collection('clarification_requests').updateOne(
      { _id: clarification.id },
      {
        $set: {
          supplier_company: supplierCompany,
          supplier_contact_name: supplierContactName,
          supplier_comments: supplierComments || clarification.supplier_comments,
          prepared_date: preparedDate || clarification.prepared_date
        }
      }
    );

    const c = colsForKind(kind);
    await db.collection('clarification_items').updateOne(
      { clarification_id: clarification.id, item_index: itemIndex },
      {
        $set: {
          [c.status]: 'received',
          [c.path]: stored.url,
          [c.name]: stored.name,
          [c.at]: new Date(),
          uploaded_by_email: uploaderEmail,
          uploaded_by_ip: ip,
          updated_at: new Date()
        }
      }
    );

    const updatedItem = await db.collection('clarification_items').findOne({ clarification_id: clarification.id, item_index: itemIndex });
    if (!updatedItem) return next(createError('Item not found for this link', 404));

    // Fire-and-forget email notification to vessel / consultant team
    const recipients = clarification.recipient_emails || env.EMAIL_FROM || env.SMTP_USER;
    if (recipients) {
      void sendMail({
        to: recipients,
        cc: clarification.cc_emails || undefined,
        subject: `[IHM Notification] MD/SDoC Uploaded - ${clarification.vessel_name || 'Vessel'} (IMO ${clarification.imo_number})`,
        html: `
          <div style="font-family: system-ui, sans-serif; padding: 20px; color: #1E293B; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px;">
            <h2 style="color: #0284C7; margin-top: 0;">MD / SDoC Document Upload Received</h2>
            <p>A new <strong>${kind.toUpperCase()}</strong> document has been uploaded by <strong>${supplierCompany}</strong>.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background: #F8FAFC; border-radius: 6px; padding: 10px;">
              <tr><td style="padding: 8px; font-weight: bold; width: 160px; color: #64748B;">Vessel:</td><td>${clarification.vessel_name || 'N/A'} (IMO: ${clarification.imo_number})</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #64748B;">Supplier:</td><td>${supplierCompany}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #64748B;">Contact Person:</td><td>${supplierContactName} (${uploaderEmail})</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #64748B;">Document Type:</td><td><span style="background: #E0F2FE; color: #0369A1; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${kind.toUpperCase()}</span></td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #64748B;">File Name:</td><td>${stored.name}</td></tr>
            </table>
            <p style="margin-top: 20px; font-size: 13px; color: #64748B;">Log into the IHM Platform to review and audit this document.</p>
          </div>
        `
      }).catch(err => console.error('[MD/SDoC Email Upload Notification Error]:', err));
    }

    res.json({
      success: true,
      data: {
        item_index: updatedItem.item_index,
        mds_status: updatedItem.mds_status,
        mds_file_name: updatedItem.mds_file_name,
        mds_file_path: updatedItem.mds_file_path,
        mds_received_at: updatedItem.mds_received_at,
        sdoc_status: updatedItem.sdoc_status,
        sdoc_file_name: updatedItem.sdoc_file_name,
        sdoc_file_path: updatedItem.sdoc_file_path,
        sdoc_received_at: updatedItem.sdoc_received_at,
      }
    });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/v1/public/clarifications/:token/items/:idx/document/:kind
 */
export async function deletePublicMdsDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.params.token as string;
    const itemIndex = Number(req.params.idx);
    if (!Number.isFinite(itemIndex) || itemIndex < 0) {
      return next(createError('Invalid item index', 400));
    }
    const kind = parseKind(req.params.kind);
    if (!kind) return next(createError("Invalid document kind. Expected 'md' or 'sdoc'.", 400));

    const clarification = await getByTokenIfValid(token);
    if (!clarification) return next(createError('Link not found or expired', 404));

    const email = (req.body as Record<string, string>).email?.trim() || '';
    if (!emailMatchesRecipients(email, clarification)) {
      return next(createError('Email does not match the address this link was sent to', 403));
    }

    const c = colsForKind(kind);
    const db = getDb();
    const existing = await db.collection('clarification_items').findOne({ clarification_id: clarification.id, item_index: itemIndex });
    const filePath = existing?.[c.path] as string | undefined;

    if (filePath) {
      const key = filePath.split('/').slice(-2).join('/');
      await deleteStoredFile(key);
    }

    await db.collection('clarification_items').updateOne(
      { clarification_id: clarification.id, item_index: itemIndex },
      {
        $set: {
          [c.status]: 'pending',
          [c.path]: null,
          [c.name]: null,
          [c.at]: null,
          updated_at: new Date()
        }
      }
    );

    res.json({ success: true });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/public/clarifications/:token/submit
 */
export async function submitPublicClarification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.params.token as string;
    const clarification = await getByTokenIfValid(token);
    if (!clarification) return next(createError('Link not found or expired', 404));

    const body = req.body as Record<string, string>;
    const email = body.email?.trim() || '';
    if (!emailMatchesRecipients(email, clarification)) {
      return next(createError('Email does not match the address this link was sent to', 403));
    }

    const supplierCompany = body.supplierCompany?.trim() || null;
    const supplierContactName = body.supplierContactName?.trim() || null;
    const supplierComments = body.supplierComments?.trim() || null;
    const preparedDate = body.preparedDate?.trim() || null;

    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || null;

    const db = getDb();

    await db.collection('clarification_requests').updateOne(
      { _id: clarification.id },
      {
        $set: {
          supplier_company: supplierCompany || clarification.supplier_company,
          supplier_contact_name: supplierContactName || clarification.supplier_contact_name,
          supplier_comments: supplierComments || clarification.supplier_comments,
          prepared_date: preparedDate || clarification.prepared_date,
          submitted_at: new Date(),
          submitted_by_ip: ip,
          status: 'submitted'
        }
      }
    );

    // Fire-and-forget email notification on full clarification submission
    const recipients = clarification.recipient_emails || env.EMAIL_FROM || env.SMTP_USER;
    if (recipients) {
      void sendMail({
        to: recipients,
        cc: clarification.cc_emails || undefined,
        subject: `[IHM Notification] MD/SDoC Clarification Submitted - ${clarification.vessel_name || 'Vessel'} (IMO ${clarification.imo_number})`,
        html: `
          <div style="font-family: system-ui, sans-serif; padding: 20px; color: #1E293B; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px;">
            <h2 style="color: #16A34A; margin-top: 0;">Supplier Documentation Submitted</h2>
            <p>The supplier <strong>${supplierCompany || clarification.supplier_company || 'Supplier'}</strong> has finalized and submitted MD/SDoC documentation for vessel <strong>${clarification.vessel_name || clarification.imo_number}</strong>.</p>
            <p>Submitted by: <strong>${supplierContactName || 'N/A'}</strong> (${email})</p>
            <p style="margin-top: 20px; font-size: 13px; color: #64748B;">Log into the IHM Platform to review the Document Audit Queue.</p>
          </div>
        `
      }).catch(err => console.error('[MD/SDoC Submission Email Notification Error]:', err));
    }

    res.json({ success: true });
  } catch (err) { next(err); }
}
