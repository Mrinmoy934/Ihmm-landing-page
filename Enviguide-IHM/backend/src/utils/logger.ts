// ─── App logger ───────────────────────────────────────────────────────────
// Tiny console-based logger with levels, color, optional request-id tag,
// and per-namespace child loggers. Pino-shaped on purpose so it can be
// swapped for a real structured logger later without touching call sites.
//
// Levels (low → high): debug, info, warn, error
//   LOG_LEVEL env var sets the threshold. Defaults to 'info' in production
//   and 'debug' in development. Anything below the threshold is dropped.
//
// Usage:
//   import { logger } from '../utils/logger.js';
//   logger.info('login ok', { user: 'narasimha' });
//   logger.error('pdf render failed', err);
//
//   // namespaced (prefixes [audit] on every line):
//   const log = logger.child('audit');
//   log.info('audit created', { id });
//
//   // request-scoped (prefixes [req:abc] in addition to namespace):
//   const log = req.log; // attached by requestId middleware
//   log.info('clarification email sent');

import { env } from '../config/env.js';

// ─── ANSI colors (Windows Terminal + macOS / Linux all support these) ────
const RESET   = '\x1b[0m';
const DIM     = '\x1b[2m';
const RED     = '\x1b[31m';
const GREEN   = '\x1b[32m';
const YELLOW  = '\x1b[33m';
const BLUE    = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN    = '\x1b[36m';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const envLevel = (process.env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug')).toLowerCase() as Level;
const THRESHOLD = LEVEL_RANK[envLevel] ?? LEVEL_RANK.info;

function ts(): string {
  // 12:34:56.789 — short enough to scan, precise enough to time things.
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function fmtArg(arg: unknown): string {
  if (arg === undefined || arg === null) return String(arg);
  if (arg instanceof Error) return `${arg.message}\n${DIM}${arg.stack ?? ''}${RESET}`;
  if (typeof arg === 'string') return arg;
  try { return JSON.stringify(arg); } catch { return String(arg); }
}

interface Tags {
  /** Namespace tag, e.g. 'audit', 'auth'. Renders as [audit]. */
  ns?: string;
  /** Request id tag, e.g. 'a3b'. Renders as [req:a3b]. */
  reqId?: string;
}

function emit(level: Level, color: string, tags: Tags, args: unknown[]): void {
  if (LEVEL_RANK[level] < THRESHOLD) return;
  const stamp = `${DIM}${ts()}${RESET}`;
  const lvl = `${color}${level.toUpperCase().padEnd(5)}${RESET}`;
  const reqTag = tags.reqId ? ` ${MAGENTA}[req:${tags.reqId}]${RESET}` : '';
  const nsTag  = tags.ns    ? ` ${CYAN}[${tags.ns}]${RESET}`         : '';
  const body = args.map(fmtArg).join(' ');
  const line = `${stamp} ${lvl}${reqTag}${nsTag} ${body}`;
  // error → stderr, everything else → stdout. Matters when piping.
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export interface AppLogger {
  debug: (...args: unknown[]) => void;
  info:  (...args: unknown[]) => void;
  warn:  (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  /** Returns a new logger with a namespace tag baked in. */
  child: (namespace: string) => AppLogger;
  /** Returns a new logger with a request-id tag baked in (used by middleware). */
  withReq: (reqId: string) => AppLogger;
}

function makeLogger(tags: Tags): AppLogger {
  return {
    debug: (...args) => emit('debug', BLUE,    tags, args),
    info:  (...args) => emit('info',  GREEN,   tags, args),
    warn:  (...args) => emit('warn',  YELLOW,  tags, args),
    error: (...args) => emit('error', RED,     tags, args),
    child: (namespace) => makeLogger({ ...tags, ns: tags.ns ? `${tags.ns}.${namespace}` : namespace }),
    withReq: (reqId)   => makeLogger({ ...tags, reqId }),
  };
}

export const logger: AppLogger = makeLogger({});

// ─── Boot banner ──────────────────────────────────────────────────────────
// Printed once at module load so it's obvious which level is active.
logger.info(`logger initialized — level=${envLevel}`);
