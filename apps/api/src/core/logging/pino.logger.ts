// Pino JSON logs; secrets and PII are redacted at the logger (07-non-functional §logging).
import type { LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-hub-signature-256"]',
  'req.headers["idempotency-key"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.apiKey',
  '*.credentials',
  '*.totpSecret',
  '*.code',
];

export const createPino = (level: string): Logger =>
  pino({ level, redact: { paths: REDACT_PATHS, censor: '[redacted]' }, base: { svc: process.env.SVC_NAME ?? 'api' } });

/** Adapts pino to Nest's LoggerService. Nest calls `log(message, context)`; our code calls `log({..}, 'msg')`. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}
  private write(level: 'info' | 'error' | 'warn' | 'debug' | 'trace', a: unknown, rest: unknown[]) {
    if (a && typeof a === 'object' && !(a instanceof Error)) {
      const [msg, ctx] = rest as [string | undefined, string | undefined];
      this.logger[level]({ ...(a as object), ctx }, msg);
    } else if (a instanceof Error) {
      this.logger[level]({ err: { message: a.message, stack: a.stack }, ctx: rest.at(-1) }, a.message);
    } else {
      this.logger[level]({ ctx: rest.at(-1) }, String(a));
    }
  }
  log(m: unknown, ...r: unknown[]) {
    this.write('info', m, r);
  }
  error(m: unknown, ...r: unknown[]) {
    this.write('error', m, r);
  }
  warn(m: unknown, ...r: unknown[]) {
    this.write('warn', m, r);
  }
  debug(m: unknown, ...r: unknown[]) {
    this.write('debug', m, r);
  }
  verbose(m: unknown, ...r: unknown[]) {
    this.write('trace', m, r);
  }
}
