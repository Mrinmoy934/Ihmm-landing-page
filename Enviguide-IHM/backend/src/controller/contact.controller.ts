import type { Request, Response, NextFunction } from 'express';
import { ContactService } from '../services/contact.service.js';
import { createError } from '../middleware/errorHandler.js';

const VALID_STATUS = ['new', 'read', 'replied', 'closed'];

/** PUBLIC — contact form submission */
export async function submitMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const msg = await ContactService.create(req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: msg });
  } catch (err) {
    if (err instanceof Error) return next(createError(err.message, 400));
    next(err);
  }
}

/** ADMIN — list inbound messages */
export async function listMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await ContactService.list({
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

export async function getMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const m = await ContactService.getById(req.params.id as string);
    if (!m) return next(createError('Message not found', 404));
    res.json({ success: true, data: m });
  } catch (err) { next(err); }
}

export async function updateMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    if (body.status && !VALID_STATUS.includes(body.status as string)) {
      return next(createError(`status must be one of: ${VALID_STATUS.join(', ')}`, 400));
    }
    const m = await ContactService.update(req.params.id as string, body);
    if (!m) return next(createError('Message not found', 404));
    res.json({ success: true, data: m });
  } catch (err) { next(err); }
}

export async function deleteMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await ContactService.getById(req.params.id as string);
    if (!existing) return next(createError('Message not found', 404));
    await ContactService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}
