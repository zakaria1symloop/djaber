/**
 * Validation helpers shared by all controllers.
 *
 *  - `validate`: express-validator bridge — put an ERROR CODE in `.withMessage('FIELD_INVALID_EMAIL')`
 *    and this middleware answers 400 VALIDATION_FAILED with translated `fields`.
 *  - `Validator`: tiny fluent checker for hand-written validation inside controllers:
 *
 *      const v = new Validator();
 *      const name = v.requiredString(req.body.name, 'name', { max: 120 });
 *      const qty  = v.integer(req.body.quantity, 'quantity', { min: 1 });
 *      const method = v.oneOf(req.body.paymentMethod, 'paymentMethod', PAYMENT_METHODS, 'cash');
 *      v.throwIfAny();          // → ApiError VALIDATION_FAILED with every field error at once
 */
import type { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ApiError, fail, fieldError, type FieldErrorInput } from '../errors';
import type { ErrorCode } from '../errors/catalog';
import { CATALOG } from '../errors/catalog';

export function validate(req: Request, res: Response, next: NextFunction): void {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const seen = new Set<string>();
  const fields: FieldErrorInput[] = [];
  for (const e of result.array()) {
    const field = e.type === 'field' ? e.path : 'body';
    if (seen.has(field)) continue;
    seen.add(field);
    const msg = String(e.msg);
    const code: ErrorCode = (msg in CATALOG ? msg : 'FIELD_INVALID') as ErrorCode;
    fields.push(fieldError(field, code));
  }
  fail(req, res, 'VALIDATION_FAILED', undefined, fields);
}

// Storage ceilings, so an absurd but well-formed number is rejected as a 400
// instead of overflowing the column and surfacing as a 500:
//   MySQL signed INT  → quantities, counters
//   Decimal(10,2)     → every money column in the schema
const MYSQL_INT_MAX = 2147483647;
const DECIMAL_10_2_MAX = 99999999.99;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Algerian numbers (0X + 8 digits, +213…) or any international number (+ and 8–15 digits).
const PHONE_RE = /^(?:(?:\+?213|0)[1-9]\d{7,8}|\+\d{8,15})$/;

export class Validator {
  readonly fields: FieldErrorInput[] = [];

  get ok(): boolean {
    return this.fields.length === 0;
  }

  add(field: string, code: ErrorCode, params?: Record<string, string | number>): void {
    this.fields.push(fieldError(field, code, params));
  }

  /** Throws VALIDATION_FAILED carrying every collected field error. */
  throwIfAny(): void {
    if (this.fields.length > 0) throw new ApiError('VALIDATION_FAILED', undefined, this.fields);
  }

  /**
   * Text input, strictly. A plain `String(value)` would turn `{}` into the
   * literal "[object Object]" and store it — so anything that is not a string
   * (or a finite number, which clients legitimately send for codes and SKUs)
   * is rejected instead of coerced. Returns `undefined` when the value had the
   * wrong type, so callers can tell "absent" from "invalid".
   */
  private asText(value: unknown, field: string): string | null | undefined {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    this.add(field, 'FIELD_MUST_BE_STRING');
    return undefined;
  }

  requiredString(value: unknown, field: string, opts: { max?: number; min?: number } = {}): string {
    const s = this.asText(value, field);
    if (s === undefined) return '';           // wrong type — already reported
    if (s === null || s === '') {
      this.add(field, 'FIELD_REQUIRED');
      return '';
    }
    return this.checkLength(s, field, opts);
  }

  optionalString(value: unknown, field: string, opts: { max?: number; min?: number } = {}): string | null {
    const s = this.asText(value, field);
    if (s === undefined) return null;         // wrong type — already reported
    if (s === null || s === '') return null;
    return this.checkLength(s, field, opts);
  }

  private checkLength(s: string, field: string, opts: { max?: number; min?: number }): string {
    if (opts.max !== undefined && s.length > opts.max) this.add(field, 'FIELD_TOO_LONG', { max: opts.max });
    if (opts.min !== undefined && s.length < opts.min) this.add(field, 'FIELD_TOO_SHORT', { min: opts.min });
    return s;
  }

  email(value: unknown, field = 'email', required = true): string | null {
    const s = required ? this.requiredString(value, field) : this.optionalString(value, field);
    if (s && !EMAIL_RE.test(s)) this.add(field, 'FIELD_INVALID_EMAIL');
    return s ? s.toLowerCase() : s;
  }

  phone(value: unknown, field = 'phone', required = false): string | null {
    const s = required ? this.requiredString(value, field) : this.optionalString(value, field);
    if (s && !PHONE_RE.test(s.replace(/[\s.-]/g, ''))) this.add(field, 'FIELD_INVALID_PHONE');
    return s;
  }

  /** Finite number; `required=false` returns `def` when absent. Capped at the column's ceiling unless `max` says otherwise. */
  number(value: unknown, field: string, opts: { min?: number; max?: number; required?: boolean; def?: number; positive?: boolean } = {}): number {
    const { required = true, def = 0 } = opts;
    if (opts.max === undefined) opts = { ...opts, max: DECIMAL_10_2_MAX };
    if (value === undefined || value === null || value === '') {
      if (required) this.add(field, 'FIELD_REQUIRED');
      return def;
    }
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n)) {
      this.add(field, 'FIELD_MUST_BE_NUMBER');
      return def;
    }
    // Most specific message first: "must be positive" / "cannot be negative"
    // read far better than a range, so they win over the generic bounds check
    // (the ceiling above is a storage guard, not a business rule).
    if (opts.positive && n <= 0) this.add(field, 'FIELD_MUST_BE_POSITIVE');
    else if (opts.min !== undefined && n < opts.min) this.add(field, opts.min === 0 ? 'FIELD_MUST_BE_NON_NEGATIVE' : 'FIELD_OUT_OF_RANGE', { min: opts.min, max: opts.max ?? '' });
    else if (opts.max !== undefined && n > opts.max) this.add(field, 'FIELD_OUT_OF_RANGE', { min: opts.min ?? 0, max: opts.max });
    return n;
  }

  integer(value: unknown, field: string, opts: { min?: number; max?: number; required?: boolean; def?: number; positive?: boolean } = {}): number {
    // Integers live in INT columns, whose ceiling is higher than Decimal(10,2).
    const n = this.number(value, field, opts.max === undefined ? { ...opts, max: MYSQL_INT_MAX } : opts);
    if (Number.isFinite(n) && !Number.isInteger(n)) this.add(field, 'FIELD_MUST_BE_INTEGER');
    return Math.trunc(n);
  }

  boolean(value: unknown, field: string, def = false): boolean {
    if (value === undefined || value === null || value === '') return def;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1 || value === '1') return true;
    if (value === 'false' || value === 0 || value === '0') return false;
    this.add(field, 'FIELD_INVALID');
    return def;
  }

  /** Value must be one of `allowed`; returns `def` when absent (and `def` is given). */
  oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[], def?: T): T {
    if (value === undefined || value === null || value === '') {
      if (def !== undefined) return def;
      this.add(field, 'FIELD_REQUIRED');
      return allowed[0];
    }
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
      this.add(field, 'FIELD_INVALID_ENUM', { allowed: allowed.join(', ') });
      return def ?? allowed[0];
    }
    return value as T;
  }

  /** Optional date (ISO or timestamp); returns null when absent. */
  date(value: unknown, field: string, opts: { required?: boolean; notFuture?: boolean } = {}): Date | null {
    if (value === undefined || value === null || value === '') {
      if (opts.required) this.add(field, 'FIELD_REQUIRED');
      return null;
    }
    const d = new Date(value as string | number | Date);
    if (isNaN(d.getTime())) {
      this.add(field, 'FIELD_INVALID_DATE');
      return null;
    }
    if (opts.notFuture && d.getTime() > Date.now() + 24 * 60 * 60 * 1000) this.add(field, 'FIELD_INVALID_DATE');
    return d;
  }

  /** Non-empty array; `item` is the translated noun used in LIST_REQUIRED ("item", "product"…). */
  nonEmptyArray<T = unknown>(value: unknown, field: string, item = 'item'): T[] {
    if (!Array.isArray(value) || value.length === 0) {
      this.add(field, 'LIST_REQUIRED', { item });
      return [];
    }
    return value as T[];
  }

  /** UUID-ish id (Prisma uuid); optional when `required=false`. */
  id(value: unknown, field: string, required = true): string | null {
    if (value === undefined || value === null || value === '') {
      if (required) this.add(field, 'FIELD_REQUIRED');
      return null;
    }
    const s = String(value).trim();
    if (!/^[0-9a-fA-F-]{8,64}$/.test(s)) {
      this.add(field, 'FIELD_INVALID_ID');
      return null;
    }
    return s;
  }
}

/** Parse `limit` / `offset` / `page` query params safely (never NaN into Prisma). */
export function pagination(query: Request['query'], defaults: { limit?: number; maxLimit?: number } = {}): { limit: number; offset: number; page: number } {
  const maxLimit = defaults.maxLimit ?? 200;
  const rawLimit = Number(query.limit ?? defaults.limit ?? 50);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.trunc(rawLimit), maxLimit) : defaults.limit ?? 50;
  const rawPage = Number(query.page);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : 1;
  const rawOffset = Number(query.offset);
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.trunc(rawOffset) : (page - 1) * limit;
  return { limit, offset, page };
}
