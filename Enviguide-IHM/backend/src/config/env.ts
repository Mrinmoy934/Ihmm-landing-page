// ============================================================
// Backend Environment Config - Validates & Exports .env
// ============================================================
// Crashes at startup if a required variable is missing,
// so you never get a mysterious runtime failure.

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

export const env = {
  PORT:         Number(optional('PORT', '8000')),
  NODE_ENV:     optional('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  MONGODB_URI:  required('MONGODB_URI'),
  JWT_SECRET:   required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),
  CORS_ORIGIN:  optional('CORS_ORIGIN', 'http://localhost:5173'),
  UPLOAD_DIR:   optional('UPLOAD_DIR', './uploads'),
  MAX_FILE_SIZE_MB: Number(optional('MAX_FILE_SIZE_MB', '10')),
  // SMTP config — kept as a fallback. On hosts that block outbound SMTP
  // (e.g. Render Free) prefer Resend by setting RESEND_API_KEY instead.
  SMTP_HOST:    process.env.SMTP_HOST,
  SMTP_PORT:    process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  SMTP_USER:    process.env.SMTP_USER,
  SMTP_PASS:    process.env.SMTP_PASS,
  EMAIL_FROM:   process.env.EMAIL_FROM,
  // Brevo transactional email API (HTTPS — works on hosts where SMTP
  // is blocked, and supports single-sender verification without DNS).
  // Preferred transport in production when set.
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  // Resend transactional email API (HTTPS). Used when BREVO_API_KEY
  // isn't set. Falls back to nodemailer/SMTP if neither is set.
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  // Dev/staging escape hatch: when set, every outgoing mail is
  // rerouted to this single address instead of its real recipient.
  // The original to/cc are preserved in the subject + body banner,
  // and the public upload page accepts this address as a recipient
  // so the supplier portal flow is fully testable without verifying
  // a sending domain on the email provider. Leave unset in
  // production; clearing it restores normal per-recipient delivery.
  EMAIL_TEST_REDIRECT_TO: process.env.EMAIL_TEST_REDIRECT_TO,
  // S3-compatible object storage for persistent file uploads.
  // Works with Supabase Storage, Cloudflare R2, AWS S3, MinIO, etc.
  // All optional — if unset, uploads stay on local disk and we serve them
  // via /uploads/* (fine for dev, ephemeral on Render's free tier).
  S3_ENDPOINT:          process.env.S3_ENDPOINT,
  S3_REGION:            optional('S3_REGION', 'auto'),
  S3_ACCESS_KEY_ID:     process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_BUCKET:            process.env.S3_BUCKET,
  S3_PUBLIC_BASE_URL:   process.env.S3_PUBLIC_BASE_URL,
  S3_FORCE_PATH_STYLE:  process.env.S3_FORCE_PATH_STYLE === 'true',
  APP_BASE_URL:         optional('APP_BASE_URL', 'https://ihm-enviguide.vercel.app'),
};
