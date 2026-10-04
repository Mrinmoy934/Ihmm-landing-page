// ============================================================
// Global Error Handler Middleware
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message    = err.message || 'Internal Server Error';

  // Prefer the per-request logger so the [req:abc] tag carries through;
  // falls back to the global logger if requestLog middleware didn't run
  // (e.g. error before middleware chain).
  const log = req.log ?? logger;
  // Operational 4xx errors (createError(...)) are expected — log as warn
  // without the stack. Anything 500+ is real, log with stack.
  if (statusCode < 500) {
    log.warn(`${req.method} ${req.originalUrl} → ${statusCode} ${message}`);
  } else {
    log.error(`${req.method} ${req.originalUrl} → ${statusCode} ${message}\n${err.stack ?? ''}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env['NODE_ENV'] !== 'production' && { stack: err.stack }),
    },
  });
}

/** Convenience factory for operational errors */
export function createError(message: string, statusCode = 500): AppError {
  const error: AppError = new Error(message);
  error.statusCode      = statusCode;
  error.isOperational   = true;
  return error;
}
