// HELP-01 / D46 — help center articles = published `CmsEntry(type=help)` (same content as the public help pages, M11).
// Locale = `lang` or `Accept-Language`, FR fallback when the requested locale is not published (`fallback: true`).
// `context` = page key of the "?" panel, matched against `CmsEntry.target.pages[]`.
import { Injectable } from '@nestjs/common';
import { prisma, TenantContext, type Prisma } from '@djaber/db';
import type { HelpArticleDto, HelpArticlesQuery } from '@djaber/shared';
import { notFound } from '../../../core/errors/app.exception';

const include = { locales: true } as const satisfies Prisma.CmsEntryInclude;
type Row = Prisma.CmsEntryGetPayload<{ include: typeof include }>;

const strip = (md: string) =>
  md
    .replace(/[#*_`>[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

@Injectable()
export class HelpService {
  private present(e: Row, requested: string, withBody: boolean): HelpArticleDto | null {
    const published = e.locales.filter((l) => l.status === 'published');
    const loc = published.find((l) => l.locale === requested) ?? published.find((l) => l.locale === 'fr');
    if (!loc) return null;
    const target = (e.target ?? {}) as { pages?: unknown };
    const plain = strip(loc.body);
    return {
      key: e.key,
      category: e.category,
      locale: loc.locale,
      requestedLocale: requested,
      fallback: loc.locale !== requested,
      title: loc.title,
      excerpt: plain.length > 200 ? `${plain.slice(0, 197).trimEnd()}…` : plain,
      ...(withBody ? { body: loc.body } : {}),
      version: e.currentVersion,
      publishedAt: e.updatedAt.toISOString(),
      contexts: Array.isArray(target.pages) ? target.pages.filter((p): p is string => typeof p === 'string') : [],
    };
  }

  private where(now: Date): Prisma.CmsEntryWhereInput {
    return { type: 'help', status: 'published', AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] };
  }

  async list(q: HelpArticlesQuery, locale: string): Promise<HelpArticleDto[]> {
    const requested = q.lang ?? locale;
    const rows = await TenantContext.runSystem(() =>
      prisma.cmsEntry.findMany({ where: { ...this.where(new Date()), ...(q.category ? { category: q.category } : {}) }, include, orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
    );
    const needle = q.q?.toLocaleLowerCase();
    return rows
      .map((r) => this.present(r, requested, true))
      .filter((a): a is HelpArticleDto => !!a)
      .filter((a) => !q.context || a.contexts.includes(q.context))
      .filter((a) => !needle || `${a.title} ${a.body ?? ''}`.toLocaleLowerCase().includes(needle))
      .map(({ body: _b, ...a }) => a);
  }

  async get(key: string, lang: string | undefined, locale: string): Promise<HelpArticleDto> {
    const row = await TenantContext.runSystem(() => prisma.cmsEntry.findFirst({ where: { key, ...this.where(new Date()) }, include }));
    const a = row ? this.present(row, lang ?? locale, true) : null;
    if (!a) throw notFound();
    return a;
  }
}
