// ============================================================
// 404 Not Found Middleware
// ============================================================

import type { Request, Response } from 'express';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}
