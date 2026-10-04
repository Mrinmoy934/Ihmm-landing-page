import type { Request, Response, NextFunction } from 'express';
import { sendMail } from '../services/email.service.js';
import { createError } from '../middleware/errorHandler.js';

export async function sendGeneralEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to, subject, body } = req.body as { to?: string; subject?: string; body?: string };
    if (!to || !subject || !body) {
      return next(createError('Fields "to", "subject", and "body" are required', 400));
    }

    const result = await sendMail({
      to,
      subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">
        <p>${body.replace(/\n/g, '<br/>')}</p>
      </div>`,
    });

    res.json({ success: true, messageId: result.messageId, transport: result.transport });
  } catch (err) {
    next(err);
  }
}
