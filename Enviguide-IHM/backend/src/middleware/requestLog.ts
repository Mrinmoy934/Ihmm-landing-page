// ─── Request-id + per-request logger ──────────────────────────────────────
// Attaches a short opaque id to every incoming request and exposes a
// per-request `log` instance with that id baked into every line. Pair with
// utils/logger.ts so service handlers can write `req.log.info(...)` and
// have it traceable across many lines for one click.
//
// The id is also surfaced as the `X-Request-Id` response header so the
// frontend (or curl -i) can quote it when reporting a failure.

import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
import { logger, type AppLogger } from '../utils/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Short opaque id for this request, e.g. 'a3b9f1'. */
    id: string;
    /** Logger pre-tagged with this request's id. */
    log: AppLogger;
  }
}

// 6-hex-char id keeps log lines compact while still giving us 16M of
// uniqueness within a session — plenty for tracing a click.
function shortId(): string {
  return randomBytes(3).toString('hex');
}

export function requestLog(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string | undefined) || shortId();
  req.id = id;
  req.log = logger.withReq(id);
  res.setHeader('X-Request-Id', id);

  const start = Date.now();
  // Log the inbound line eagerly so we see the request even if the
  // handler hangs. The morgan middleware separately prints the
  // completion line with status + duration.
  req.log.info(`→ ${req.method} ${req.originalUrl}`);

  res.on('finish', () => {
    const ms = Date.now() - start;
    const tag = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    req.log[tag](`← ${req.method} ${req.originalUrl} ${res.statusCode} (${ms}ms)`);
  });

  next();
}
