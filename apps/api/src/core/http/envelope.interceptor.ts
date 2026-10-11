// 09-code-conventions §2.2 — success envelope { data, meta }
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { map } from 'rxjs';
import { isPage } from './pagination';

export type Warning = { code: string; params?: Record<string, unknown>; field?: string };

/** Request-scoped warnings (`meta.warnings`) are kept on the request object to avoid request-scoped providers. */
export const addWarning = (req: { warnings?: Warning[] }, code: string, params?: Record<string, unknown>, field?: string) => {
  (req.warnings ??= []).push({ code, params, ...(field ? { field } : {}) });
};

/** Marker for handlers that already return the final body (webhook acks, redirects, files). */
export class RawResponse<T = unknown> {
  constructor(public readonly body: T) {}
}

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(
      map((body) => {
        if (body instanceof RawResponse) return body.body;
        if (body instanceof StreamableFile || Buffer.isBuffer(body)) return body;
        const warnings: Warning[] = req.warnings ?? [];
        if (body === undefined || body === null) return { data: null, meta: { warnings } };
        if (isPage(body)) {
          // list-level figures that follow the filters (e.g. `meta.totalValue` of GET /stock/snapshot) ride in `body.meta`
          const extra = (body as { meta?: Record<string, unknown> }).meta ?? {};
          return { data: body.data, meta: { ...extra, page: body.page, pageSize: body.pageSize, total: body.total, warnings } };
        }
        if (typeof body === 'object' && 'nextCursor' in body && 'data' in body) {
          const b = body as { data: unknown; nextCursor: string | null };
          return { data: b.data, meta: { nextCursor: b.nextCursor, hasMore: b.nextCursor !== null, warnings } };
        }
        if (typeof body === 'object' && 'results' in body && Array.isArray((body as { results: unknown }).results)) {
          const r = (body as { results: { ok: boolean }[] }).results;
          return {
            data: { results: r },
            meta: { ok: r.filter((x) => x.ok).length, failed: r.filter((x) => !x.ok).length, warnings },
          };
        }
        return { data: body, meta: { warnings } };
      }),
    );
  }
}
