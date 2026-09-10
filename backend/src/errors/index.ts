/**
 * ONE error contract for the whole API — every non-2xx answer is built here.
 *
 *   {
 *     "error":   "Not Found",              // legacy label (kept for old clients)
 *     "code":    "PRODUCT_NOT_FOUND",      // stable machine key — what clients switch on
 *     "message": "Produit introuvable.",   // human text, ALREADY translated (en / fr / ar)
 *     "params":  { ... },                  // values interpolated in the message (optional)
 *     "fields":  [ { "field": "email", "code": "FIELD_INVALID_EMAIL", "message": "..." } ],  // validation (optional)
 *     "errors":  [ { "msg": "...", "path": "email", "location": "body" } ]                    // legacy mirror of fields
 *   }
 *
 * The language comes from the request: `?lang=ar`, then the `X-Lang` header,
 * then `Accept-Language`, else English. The HTTP status carries the category
 * (400 validation, 401 auth, 403 rights, 404 missing, 409 conflict, 413 size,
 * 422 business rule, 5xx server); the `code` carries the exact reason.
 *
 * Usage inside a controller:
 *   if (!name) return fail(req, res, 'FIELD_REQUIRED', { field: 'name' });
 *   throw new ApiError('ORDER_NOT_FOUND');                  // caught by handleError / global handler
 *   catch (error) { return handleError(req, res, error, 'ORDER_CREATE_FAILED'); }
 */
import type { Request, Response } from 'express';
import { CATALOG, type ErrorCode } from './catalog';

export type Lang = 'en' | 'fr' | 'ar';
export const LANGS: readonly Lang[] = ['en', 'fr', 'ar'];
export const DEFAULT_LANG: Lang = 'en';

export type Params = Record<string, string | number | boolean | null | undefined>;

export interface FieldErrorInput {
  field: string;
  code: ErrorCode;
  params?: Params;
}

export interface FieldErrorOutput {
  field: string;
  code: ErrorCode;
  message: string;
  params?: Params;
}

export interface ErrorBody {
  error: string;
  code: ErrorCode;
  message: string;
  params?: Params;
  fields?: FieldErrorOutput[];
  errors?: { msg: string; path: string; location: 'body' }[];
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

function pickLang(value: unknown): Lang | null {
  if (typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return (LANGS as readonly string[]).includes(base) ? (base as Lang) : null;
}

/** Language of the caller: `?lang`, `X-Lang`, `Accept-Language` (q-ordered), else `en`. */
export function resolveLang(req: Request): Lang {
  const fromQuery = pickLang(req.query?.lang);
  if (fromQuery) return fromQuery;

  const fromHeader = pickLang(req.headers['x-lang']);
  if (fromHeader) return fromHeader;

  const accept = req.headers['accept-language'];
  if (typeof accept === 'string' && accept.trim() !== '') {
    const ranked = accept
      .split(',')
      .map((part, index) => {
        const [tag, ...rest] = part.trim().split(';');
        const q = rest.find((p) => p.trim().startsWith('q='));
        const weight = q ? Number(q.trim().slice(2)) : 1;
        return { tag, weight: Number.isFinite(weight) ? weight : 0, index };
      })
      .sort((a, b) => b.weight - a.weight || a.index - b.index);
    for (const { tag } of ranked) {
      const lang = pickLang(tag);
      if (lang) return lang;
    }
  }
  return DEFAULT_LANG;
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/** Translated message for a code (falls back to English, then to the code itself). */
export function translate(lang: Lang, code: ErrorCode, params?: Params): string {
  const def = CATALOG[code];
  if (!def) return String(code);
  const template = def[lang] || def.en || String(code);
  return interpolate(template, params);
}

export function statusOf(code: ErrorCode): number {
  return CATALOG[code]?.status ?? 500;
}

const STATUS_LABEL: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

export function statusLabel(status: number): string {
  return STATUS_LABEL[status] ?? (status >= 500 ? 'Server Error' : 'Error');
}

// ---------------------------------------------------------------------------
// ApiError — throw it anywhere below a controller; handleError turns it into JSON
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly params?: Params;
  readonly fields?: FieldErrorInput[];

  constructor(code: ErrorCode, params?: Params, fields?: FieldErrorInput[], status?: number) {
    super(String(code));
    this.name = 'ApiError';
    this.code = code;
    this.params = params;
    this.fields = fields;
    this.status = status ?? statusOf(code);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError || (typeof err === 'object' && err !== null && (err as ApiError).name === 'ApiError');
}

/** Shorthand for a field-level validation entry. */
export function fieldError(field: string, code: ErrorCode, params?: Params): FieldErrorInput {
  return { field, code, params: { field, ...(params ?? {}) } };
}

/** Throw a VALIDATION_FAILED ApiError carrying field errors (no-op when the list is empty). */
export function throwIfFieldErrors(fields: FieldErrorInput[]): void {
  if (fields.length > 0) throw new ApiError('VALIDATION_FAILED', undefined, fields);
}

// ---------------------------------------------------------------------------
// Building + sending the JSON body
// ---------------------------------------------------------------------------

export function buildErrorBody(lang: Lang, code: ErrorCode, params?: Params, fields?: FieldErrorInput[], status?: number): { status: number; body: ErrorBody } {
  const finalStatus = status ?? statusOf(code);
  const body: ErrorBody = {
    error: statusLabel(finalStatus),
    code,
    message: translate(lang, code, params),
  };
  if (params && Object.keys(params).length > 0) body.params = params;
  if (fields && fields.length > 0) {
    body.fields = fields.map((f) => ({
      field: f.field,
      code: f.code,
      message: translate(lang, f.code, { field: f.field, ...(f.params ?? {}) }),
      ...(f.params ? { params: f.params } : {}),
    }));
    // Legacy mirror (express-validator shape) so old clients keep working.
    body.errors = body.fields.map((f) => ({ msg: f.message, path: f.field, location: 'body' as const }));
  }
  return { status: finalStatus, body };
}

/** Send a translated error for `code`. Returns void so callers can `return fail(...)`. */
export function fail(req: Request, res: Response, code: ErrorCode, params?: Params, fields?: FieldErrorInput[], status?: number): void {
  const { status: finalStatus, body } = buildErrorBody(resolveLang(req), code, params, fields, status);
  res.status(finalStatus).json(body);
}

// ---------------------------------------------------------------------------
// Unexpected errors — map what we can, log the rest, never leak internals
// ---------------------------------------------------------------------------

interface PrismaLikeError {
  code?: string;
  meta?: { target?: unknown; field_name?: unknown; cause?: unknown };
  message?: string;
}

/**
 * Turn any thrown value into an ApiError: ApiError as-is, Prisma known errors
 * to their business meaning, body-parser / multer errors to 400 / 413,
 * everything else to `fallback` (500 by default).
 */
export function toApiError(err: unknown, fallback: ErrorCode = 'INTERNAL_ERROR'): ApiError {
  if (isApiError(err)) return err as ApiError;

  const e = (err ?? {}) as PrismaLikeError & { type?: string; status?: number; name?: string; field?: string };

  // Prisma
  if (typeof e.code === 'string' && /^P\d{4}$/.test(e.code)) {
    const target = Array.isArray(e.meta?.target) ? (e.meta!.target as unknown[]).join(', ') : typeof e.meta?.target === 'string' ? e.meta.target : undefined;
    switch (e.code) {
      case 'P2002': return new ApiError('DUPLICATE', target ? { field: target } : undefined);
      case 'P2025': return new ApiError('NOT_FOUND');
      case 'P2003': return new ApiError('INVALID_REFERENCE', typeof e.meta?.field_name === 'string' ? { field: e.meta.field_name } : undefined);
      case 'P2000': return new ApiError('FIELD_TOO_LONG', undefined);
      default: return new ApiError(fallback);
    }
  }

  // body-parser (express.json)
  if (e.type === 'entity.parse.failed') return new ApiError('INVALID_JSON');
  if (e.type === 'entity.too.large') return new ApiError('PAYLOAD_TOO_LARGE');

  // multer
  if (e.name === 'MulterError') {
    switch (e.code) {
      case 'LIMIT_FILE_SIZE': return new ApiError('FILE_TOO_LARGE', { maxMb: 5 });
      case 'LIMIT_FILE_COUNT': return new ApiError('TOO_MANY_FILES', { max: 10 });
      case 'LIMIT_UNEXPECTED_FILE': return new ApiError('UPLOAD_UNEXPECTED_FIELD', { field: e.field ?? '' });
      default: return new ApiError('UPLOAD_FAILED');
    }
  }

  return new ApiError(fallback);
}

/**
 * Catch-all for controller `catch` blocks: logs the real error server-side and
 * answers the client with a translated, code-bearing body.
 */
export function handleError(req: Request, res: Response, err: unknown, fallback: ErrorCode = 'INTERNAL_ERROR'): void {
  const apiErr = toApiError(err, fallback);
  if (apiErr.status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}] ${apiErr.code}:`, err);
  }
  if (res.headersSent) return;
  fail(req, res, apiErr.code, apiErr.params, apiErr.fields, apiErr.status);
}

/** Assert a condition or throw the given ApiError (narrowing helper). */
export function ensure(condition: unknown, code: ErrorCode, params?: Params): asserts condition {
  if (!condition) throw new ApiError(code, params);
}

export { CATALOG, type ErrorCode } from './catalog';
