import type { Request, Response, NextFunction } from 'express';
import { SuspectedKeywordService } from '../services/suspectedKeyword.service.js';
import { createError } from '../middleware/errorHandler.js';

const VALID_SEVERITY = ['Critical', 'High', 'Medium', 'Low'];

export async function listKeywords(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await SuspectedKeywordService.list({
      status: req.query.status as string | undefined,
      hazardType: req.query.hazardType as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
}

export async function getKeyword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const k = await SuspectedKeywordService.getById(req.params.id as string);
    if (!k) return next(createError('Keyword not found', 404));
    res.json({ success: true, data: k });
  } catch (err) { next(err); }
}

export async function createKeyword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    if (body.severity && !VALID_SEVERITY.includes(body.severity as string)) {
      return next(createError(`severity must be one of: ${VALID_SEVERITY.join(', ')}`, 400));
    }
    const k = await SuspectedKeywordService.create(body);
    res.status(201).json({ success: true, data: k });
  } catch (err) {
    if (err instanceof Error) return next(createError(err.message, 400));
    next(err);
  }
}

export async function updateKeyword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    if (body.severity && !VALID_SEVERITY.includes(body.severity as string)) {
      return next(createError(`severity must be one of: ${VALID_SEVERITY.join(', ')}`, 400));
    }
    const k = await SuspectedKeywordService.update(req.params.id as string, body);
    if (!k) return next(createError('Keyword not found', 404));
    res.json({ success: true, data: k });
  } catch (err) { next(err); }
}

export async function deleteKeyword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await SuspectedKeywordService.getById(req.params.id as string);
    if (!existing) return next(createError('Keyword not found', 404));
    await SuspectedKeywordService.delete(req.params.id as string);
    res.status(204).send();
  } catch (err) { next(err); }
}

/** POST /api/v1/suspected-keywords/match — test a string against the keyword list */
export async function matchKeyword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { text } = req.body as { text?: string };
    if (!text) return next(createError('text is required', 400));
    const match = await SuspectedKeywordService.findMatch([text]);
    res.json({ success: true, data: match });
  } catch (err) { next(err); }
}
