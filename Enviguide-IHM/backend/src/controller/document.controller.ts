import type { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/document.service.js';
import { VesselService } from '../services/vessel.service.js';
import { createError } from '../middleware/errorHandler.js';
import { persistUploadedFile, deleteStoredFile, getStoredFileStream } from '../services/storage.service.js';

const VALID_TYPES = ['IHM Report', 'SOC', 'Ship Particulars', 'MD', 'SDoC', 'Other', 'Certificate', 'Manual', 'Drawing', 'Declaration'];
const VALID_STATUS = ['pending', 'approved', 'rejected', 'expired'];

async function verify(userId: string, vesselId: string, next: NextFunction) {
  const v = await VesselService.getVesselByIdForUser(vesselId, userId);
  if (!v) { next(createError('Vessel not found', 404)); return null; }
  return v;
}

/** GET /api/v1/vessels/:vesselId/documents */
export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const v = await verify(req.user!.userId, vesselId, next);
    if (!v) return;

    const filters = {
      documentType: req.query.documentType as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    };

    const documents = await DocumentService.getDocumentsForVessel(vesselId, filters);
    const total = await DocumentService.getDocumentCount(vesselId);
    res.json({ success: true, data: documents, total });
  } catch (err) { next(err); }
}

/** POST /api/v1/vessels/:vesselId/documents */
export async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const v = await verify(req.user!.userId, vesselId, next);
    if (!v) return;

    if (!req.file) return next(createError('File is required', 400));

    const { name, documentType, category, description } = req.body as Record<string, string>;

    if (!documentType || !VALID_TYPES.includes(documentType)) {
      return next(createError(`documentType must be one of: ${VALID_TYPES.join(', ')}`, 400));
    }

    // Persist to storage (scopes under S3 bucket as: vessels/<vesselId>/documents/<filename>)
    const stored = await persistUploadedFile(req.file.path, req.file.originalname, `vessels/${vesselId}/documents`, req.file.mimetype);

    const data = {
      name: name || req.file.originalname,
      documentType,
      category: category || 'general',
      status: 'pending',
      fileName: req.file.originalname,
      filePath: stored.url,
      storageKey: stored.key || null,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user!.email,
      description,
    };

    const doc = await DocumentService.createDocument(data, vesselId);
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
}

/** GET /api/v1/vessels/:vesselId/documents/:id */
export async function getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const v = await verify(req.user!.userId, vesselId, next);
    if (!v) return;

    const doc = await DocumentService.getDocumentById(req.params.id as string, vesselId);
    if (!doc) return next(createError('Document not found', 404));
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
}

/** PUT /api/v1/vessels/:vesselId/documents/:id */
export async function updateDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const v = await verify(req.user!.userId, vesselId, next);
    if (!v) return;

    const existing = await DocumentService.getDocumentById(req.params.id as string, vesselId);
    if (!existing) return next(createError('Document not found', 404));

    const body = req.body as Record<string, unknown>;
    if (body.status && !VALID_STATUS.includes(body.status as string)) {
      return next(createError(`status must be one of: ${VALID_STATUS.join(', ')}`, 400));
    }

    const doc = await DocumentService.updateDocument(req.params.id as string, body);
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/vessels/:vesselId/documents/:id */
export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const v = await verify(req.user!.userId, vesselId, next);
    if (!v) return;

    const existing = await DocumentService.getDocumentById(req.params.id as string, vesselId);
    if (!existing) return next(createError('Document not found', 404));

    // Clean up S3 storage if storageKey is active
    if (existing.storageKey) {
      await deleteStoredFile(existing.storageKey as string);
    }

    await DocumentService.deleteDocument(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}


/**
 * GET /api/v1/vessels/:vesselId/documents/:id/stream
 * Streams the file through the backend with Content-Disposition: inline so
 * the browser renders it inside the iframe instead of downloading it.
 * Also defeats S3/Supabase X-Frame-Options headers.
 * ?disposition=attachment  →  switches to download mode
 */
export async function streamDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const vesselId = req.params.vesselId as string;
    const v = await verify(req.user!.userId, vesselId, next);
    if (!v) return;

    const doc = await DocumentService.getDocumentById(req.params.id as string, vesselId);
    if (!doc) return next(createError('Document not found', 404));

    const filePath = (doc.storageKey || doc.filePath) as string | undefined;
    if (!filePath) return next(createError('File not available', 404));

    const disposition = req.query.disposition === 'attachment' ? 'attachment' : 'inline';
    // Original filename stored at upload time; fall back to doc.name
    const safeName = String(doc.fileName || doc.name || 'document').replace(/"/g, '');

    const stream = await getStoredFileStream(filePath);
    if (!stream) {
      // Local dev fallback — file is on disk, serve inline via redirect
      // (express static handler already sets correct headers for local files)
      return res.redirect(String(doc.filePath));
    }

    const mime = (doc.mimeType || stream.contentType || 'application/octet-stream') as string;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
    // Allow embedding in iframes from the same origin
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.removeHeader('X-Content-Type-Options');
    if (stream.contentLength) res.setHeader('Content-Length', String(stream.contentLength));
    res.setHeader('Cache-Control', 'private, max-age=120');

    (stream.body as NodeJS.ReadableStream).pipe(res);
    (stream.body as NodeJS.ReadableStream).on('error', () => res.destroy());
  } catch (err) { next(err); }
}
