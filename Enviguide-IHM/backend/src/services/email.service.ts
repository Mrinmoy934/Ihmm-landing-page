// -- Email Service ----------------------------------------
// Three delivery transports, picked at runtime in this priority order:
//
//   1. Brevo (HTTPS, port 443) — used when BREVO_API_KEY is set.
//      Supports single-sender verification (no DNS), so this is the
//      easiest way to ship real-recipient delivery on Render Free.
//
//   2. Resend (HTTPS, port 443) — used when RESEND_API_KEY is set
//      and Brevo isn't. Requires domain verification for arbitrary
//      recipients.
//
//   3. Nodemailer SMTP — fallback when only SMTP_HOST/USER/PASS are
//      set. Useful for local development against Mailtrap. Will fail
//      on hosts that block outbound SMTP (e.g. Render Free).
//
// All three share the same SendMailInput contract, the "self-send
// Bcc reroute" rule (any To/Cc address that matches the authenticated
// sender is moved to Bcc), and the EMAIL_TEST_REDIRECT_TO escape
// hatch. Switching transports just means flipping env vars — no
// callsite changes needed anywhere else.

import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const emailLog = logger.child('email');

// ─── Transport selection ────────────────────────────────────────────────

/** Parse a "Display Name <email@x.com>" string into its parts.
 *  Bare email also accepted ("email@x.com"). Brevo's API wants them
 *  separated; nodemailer/Resend take the combined form directly. */
function parseAddress(addr: string): { name?: string; email: string } {
  const trimmed = addr.trim();
  const m = trimmed.match(/^([^<]*)<\s*([^>\s]+)\s*>\s*$/);
  if (m) {
    const name = m[1]!.trim().replace(/^"|"$/g, '');
    return { name: name || undefined, email: m[2]! };
  }
  return { email: trimmed };
}

interface BrevoSendBody {
  sender: { name?: string; email: string };
  to: { email: string; name?: string }[];
  cc?: { email: string }[];
  bcc?: { email: string }[];
  replyTo?: { email: string };
  subject: string;
  htmlContent: string;
  textContent?: string;
}

async function sendViaBrevo(body: BrevoSendBody): Promise<{ messageId: string }> {
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('Email not configured. Set BREVO_API_KEY in environment.');
  }
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    const detail = errorBody.message
      ? `${errorBody.code ? `[${errorBody.code}] ` : ''}${errorBody.message}`
      : `HTTP ${response.status}`;
    throw new Error(`Brevo: ${detail}`);
  }
  const data = (await response.json()) as { messageId?: string };
  return { messageId: data.messageId ?? '' };
}

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error('Email not configured. Set RESEND_API_KEY in environment.');
  }
  if (!resendClient) resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

let smtpTransporter: Transporter | null = null;
function getSmtpTransporter(): Transporter {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error(
      'Email not configured. Set BREVO_API_KEY (preferred), RESEND_API_KEY, or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in environment.',
    );
  }
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return smtpTransporter;
}

// ─── Public API ─────────────────────────────────────────────────────────

export interface SendMailInput {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; path: string }>;
}

export interface SendMailResult {
  messageId: string;
  /** Which transport actually delivered — useful for logs / debugging.
   *  `log` means no transport was configured: the message was written
   *  to stdout instead of being sent. Local-dev only. */
  transport: 'brevo' | 'resend' | 'smtp' | 'log';
}

/** Normalise a to/cc/bcc field into a trimmed, de-duped array. */
function toList(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const raw = Array.isArray(v) ? v : v.split(/[,;]/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const trimmed = String(entry).trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Reroute any recipient that matches the authenticated sender (EMAIL_FROM
 * or SMTP_USER) into Bcc — Gmail / Workspace deliver self-addressed mail
 * to the Sent folder only, so without this the sender wouldn't see their
 * own copy in their Inbox.
 */
function applySelfSendBcc(input: SendMailInput) {
  const senderAliases = new Set(
    [env.EMAIL_FROM, env.SMTP_USER]
      .filter((v): v is string => Boolean(v))
      .map((v) => v.toLowerCase()),
  );
  const isSelf = (addr: string) => senderAliases.has(addr.toLowerCase());

  const toRaw = toList(input.to);
  const ccRaw = toList(input.cc);
  const bccRaw = toList(input.bcc);

  const toKept = toRaw.filter((a) => !isSelf(a));
  const ccKept = ccRaw.filter((a) => !isSelf(a));
  const bccExtras = [
    ...toRaw.filter(isSelf),
    ...ccRaw.filter(isSelf),
  ];

  const to = toKept.length === 0 && ccKept.length === 0 && bccExtras.length === 0
    ? toRaw
    : toKept;
  const bcc = toList([...bccRaw, ...bccExtras]);

  return { to, cc: ccKept, bcc };
}

/**
 * If EMAIL_TEST_REDIRECT_TO is set, reroute the outgoing mail to that
 * single address — useful while the email provider's sandbox blocks
 * sends to anyone other than the signup address. The original to/cc
 * are preserved in the subject and a banner at the top of the body so
 * the tester can still tell which vendor each mail was meant for.
 */
function applyTestRedirect(
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  text: string | undefined,
  html: string | undefined,
): { to: string[]; cc: string[]; bcc: string[]; subject: string; text: string | undefined; html: string | undefined } {
  const redirect = env.EMAIL_TEST_REDIRECT_TO?.trim();
  if (!redirect) return { to, cc, bcc, subject, text, html };

  const originalTo = to.join(', ');
  const originalCc = cc.length > 0 ? cc.join(', ') : '';
  const newSubject = `[TEST → ${originalTo}]${originalCc ? ` (cc: ${originalCc})` : ''} ${subject}`;
  const banner =
    '⚠️ TEST REDIRECT — this email was meant for:\n'
    + `  To:  ${originalTo}\n`
    + (originalCc ? `  Cc:  ${originalCc}\n` : '')
    + 'Set EMAIL_TEST_REDIRECT_TO to "" in the host env vars to deliver real recipients.\n'
    + '──────────────────────────────────────────────────\n\n';
  const htmlBanner =
    '<div style="background:#FEF3C7;border:1px solid #F59E0B;color:#92400E;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-family:system-ui,sans-serif;font-size:13px;">'
    + '<strong>⚠️ TEST REDIRECT</strong><br/>'
    + `<div style="margin-top:6px"><strong>To:</strong> ${originalTo}</div>`
    + (originalCc ? `<div><strong>Cc:</strong> ${originalCc}</div>` : '')
    + '<div style="margin-top:6px;font-size:11px;opacity:0.8">Clear <code>EMAIL_TEST_REDIRECT_TO</code> in the host env vars to deliver real recipients.</div>'
    + '</div>';

  return {
    to: [redirect],
    cc: [],
    bcc: [],
    subject: newSubject,
    text: text ? banner + text : undefined,
    html: html ? htmlBanner + html : undefined,
  };
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const { to, cc, bcc } = applySelfSendBcc(input);
  const fromAddr = env.EMAIL_FROM || env.SMTP_USER || 'onboarding@resend.dev';
  const replyTo = input.replyTo || env.EMAIL_FROM || env.SMTP_USER;
  const redirected = applyTestRedirect(to, cc, bcc, input.subject, input.text, input.html);
  const t0 = Date.now();
  emailLog.info(`send → to=${redirected.to.join(',') || '(none)'} subj="${redirected.subject.slice(0, 60)}"`);

  // Prefer Brevo when configured (HTTPS, single-sender verified — no DNS).
  if (env.BREVO_API_KEY) {
    const sender = parseAddress(fromAddr);
    const { messageId } = await sendViaBrevo({
      sender,
      to: redirected.to.length > 0 ? redirected.to.map((email) => ({ email })) : [{ email: sender.email }],
      cc: redirected.cc.length > 0 ? redirected.cc.map((email) => ({ email })) : undefined,
      bcc: redirected.bcc.length > 0 ? redirected.bcc.map((email) => ({ email })) : undefined,
      replyTo: replyTo ? { email: parseAddress(replyTo).email } : undefined,
      subject: redirected.subject,
      htmlContent: redirected.html ?? redirected.text ?? '',
      textContent: redirected.text,
    });
    emailLog.info(`✓ brevo ok id=${messageId} ${Date.now() - t0}ms`);
    return { messageId, transport: 'brevo' };
  }

  // Fall back to Resend if Brevo isn't configured.
  if (env.RESEND_API_KEY) {
    const r = getResendClient();
    const { data, error } = await r.emails.send({
      from: fromAddr,
      to: redirected.to.length > 0 ? redirected.to : [fromAddr],
      cc: redirected.cc.length > 0 ? redirected.cc : undefined,
      bcc: redirected.bcc.length > 0 ? redirected.bcc : undefined,
      replyTo,
      subject: redirected.subject,
      text: redirected.text ?? '',
      html: redirected.html ?? redirected.text ?? '',
    });
    if (error) {
      // Resend SDK returns errors via the destructured `error` rather than
      // throwing — surface them as a thrown Error so callers handle a
      // single shape regardless of transport.
      const msg = (error as { message?: string })?.message
        ?? (error as { name?: string })?.name
        ?? 'Resend send failed';
      emailLog.error(`✗ resend fail ${Date.now() - t0}ms :: ${msg}`);
      throw new Error(msg);
    }
    emailLog.info(`✓ resend ok id=${data?.id ?? ''} ${Date.now() - t0}ms`);
    return { messageId: data?.id ?? '', transport: 'resend' };
  }

  // SMTP — used when SMTP_HOST/PORT/USER/PASS are configured (e.g. a
  // local Mailtrap, or your own SMTP server on Linode).
  const smtpReady = env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS;
  if (smtpReady) {
    const t = getSmtpTransporter();
    const result = await t.sendMail({
      from: fromAddr,
      replyTo,
      to: redirected.to.length > 0 ? redirected.to : undefined,
      cc: redirected.cc.length > 0 ? redirected.cc : undefined,
      bcc: redirected.bcc.length > 0 ? redirected.bcc : undefined,
      subject: redirected.subject,
      text: redirected.text,
      html: redirected.html,
      attachments: input.attachments,
    });
    emailLog.info(`✓ smtp ok id=${(result as { messageId?: string }).messageId ?? ''} ${Date.now() - t0}ms`);
    return { messageId: (result as { messageId?: string }).messageId ?? '', transport: 'smtp' };
  }

  // Last resort: nothing configured. Log to stdout and return a fake
  // messageId so the rest of the flow (audit status flips, reminder
  // counters, etc.) still works in local-only setups. Production should
  // never hit this branch — set a real transport.
  emailLog.warn('No transport configured — logging email to stdout instead of sending.');
  emailLog.warn(`To: ${redirected.to.join(', ') || '(none)'}`);
  if (redirected.cc.length) emailLog.warn(`Cc: ${redirected.cc.join(', ')}`);
  if (redirected.bcc.length) emailLog.warn(`Bcc: ${redirected.bcc.join(', ')}`);
  emailLog.warn(`Subject: ${redirected.subject}`);
  if (redirected.text) emailLog.warn(`Text: ${redirected.text.slice(0, 500)}`);
  return { messageId: `log-${Date.now()}`, transport: 'log' };
}
