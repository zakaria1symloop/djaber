// api-contract §1.4 / LST-04 — bulk endpoints: every id on its own (one transaction each), never stopping at the first
// error; `{ results: [{ id, ok, error?, data? }] }` becomes `{ data: { results }, meta: { ok, failed } }` (EnvelopeInterceptor).
import { ERROR_CODES, type ErrorCode } from '@djaber/shared';
import { prisma, type Tx } from '@djaber/db';
import { AppException } from '../errors/app.exception';
import type { I18nService } from '../i18n/i18n.service';
import type { BulkResult } from './pagination';

export type BulkCtx = { locale: string; ref: string };
export const bulkCtx = (req: { locale?: string; id?: string }): BulkCtx => ({ locale: req.locale ?? 'fr', ref: req.id ?? 'unknown' });

export const bulkFailure = (i18n: I18nService, id: string, e: AppException, ctx: BulkCtx): BulkResult => {
  const code: ErrorCode = e.code in ERROR_CODES ? e.code : 'INTERNAL';
  const params = e.params ?? {};
  return { id, ok: false, error: { code, message: i18n.t(ctx.locale, `error.${code}`, { ...params, ref: ctx.ref }), params, ...(Object.keys(e.fields).length ? { fields: e.fields } : {}), ref: ctx.ref } };
};

/** Runs `fn` per unique id in its own transaction (or without one when `fn` opens its own: `ownTx`). */
export const runBulk = async (i18n: I18nService, ids: string[], ctx: BulkCtx, fn: (id: string, tx?: Tx) => Promise<unknown>, o: { ownTx?: boolean } = {}): Promise<{ results: BulkResult[] }> => {
  const results: BulkResult[] = [];
  for (const id of [...new Set(ids)]) {
    try {
      const data = o.ownTx ? await fn(id) : await prisma.$transaction((db) => fn(id, db as Tx));
      results.push({ id, ok: true, ...(data !== undefined ? { data } : {}) });
    } catch (e) {
      if (!(e instanceof AppException)) throw e;
      results.push(bulkFailure(i18n, id, e, ctx));
    }
  }
  return { results };
};
