// PUB-03 / PUB-04 / ADM-06 (public side) — published CMS entries for the server-rendered public pages (06 §12 `GET /cms/:key`,
// api-contract §3.14 `CmsEntryDto`). Locale = `lang` or Accept-Language; a locale that is not published falls back to French
// (`fallback: true`); unpublished / out-of-window / unknown ⇒ 404. Admin preview: signed token of `GET /admin/cms/:id/preview-link`
// (24 h) serves the current draft texts.
import { Injectable } from '@nestjs/common';
import type { CmsEntryDto, CmsListItemDto, CmsListQuery } from '@djaber/shared';
import { prisma, TenantContext, type Prisma } from '@djaber/db';
import { TokenService } from '../../core/auth/token.service';
import { notFound } from '../../core/errors/app.exception';

/** Entry types that have a public page (e-mails, announcements, plan texts and default system messages do not). */
const PUBLIC_TYPES = ['legal', 'help', 'page'] as const;
const include = { locales: true, versions: { orderBy: { version: 'desc' as const } } } as const satisfies Prisma.CmsEntryInclude;
type Row = Prisma.CmsEntryGetPayload<{ include: typeof include }>;
type Locale = 'fr' | 'ar' | 'en';

/** Body of `locale` in a version snapshot (admin format `{ locales: [{ locale, body }] }` or seed format `{ body: { fr, ar, en } }`). */
export const snapshotBody = (snapshot: unknown, locale: string): string | null => {
  const s = (snapshot ?? {}) as { locales?: { locale: string; body: string }[]; body?: Record<string, string> };
  if (Array.isArray(s.locales)) return s.locales.find((l) => l.locale === locale)?.body ?? null;
  if (s.body && typeof s.body === 'object') return s.body[locale] ?? null;
  return null;
};

@Injectable()
export class CmsPublicService {
  constructor(private readonly tokens: TokenService) {}

  private live(now: Date): Prisma.CmsEntryWhereInput {
    return { status: 'published', type: { in: [...PUBLIC_TYPES] }, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] };
  }

  private present(e: Row, requested: Locale, preview: boolean): CmsEntryDto | null {
    const usable = preview ? e.locales : e.locales.filter((l) => l.status === 'published');
    const loc = usable.find((l) => l.locale === requested) ?? usable.find((l) => l.locale === 'fr');
    if (!loc) return null;
    const published = e.versions.filter((v) => v.version <= Math.max(e.currentVersion, 1));
    const previous = published.find((v) => v.version === e.currentVersion - 1);
    const current = published.find((v) => v.version === e.currentVersion);
    return {
      key: e.key,
      type: e.type,
      category: e.category,
      locale: loc.locale,
      requestedLocale: requested,
      fallback: loc.locale !== requested,
      title: loc.title,
      body: loc.body,
      version: Math.max(e.currentVersion, 1),
      publishedAt: (current?.at ?? e.updatedAt).toISOString(),
      versions: published.map((v) => ({ version: v.version, publishedAt: v.at.toISOString() })),
      previousBody: previous ? snapshotBody(previous.snapshot, loc.locale) : null,
      preview,
    };
  }

  /** `GET /cms/:key?lang=&preview=` and `GET /legal/:key` (`type` = legal only). */
  async get(key: string, locale: Locale, o: { preview?: string; type?: 'legal' } = {}): Promise<CmsEntryDto> {
    if (o.preview) return this.preview(o.preview, locale, key);
    const row = await TenantContext.runSystem(() => prisma.cmsEntry.findFirst({ where: { key, ...this.live(new Date()), ...(o.type ? { type: o.type } : {}) }, include }));
    const dto = row ? this.present(row, locale, false) : null;
    if (!dto) throw notFound();
    return dto;
  }

  /** `GET /cms/preview/:token` — admin signed link (24 h); unpublished and draft texts included. */
  async preview(token: string, locale: Locale, key?: string): Promise<CmsEntryDto> {
    const p = await this.tokens.verifyPurpose<{ entryId: string; key: string }>(token, 'cms_preview').catch(() => null);
    if (!p || (key && p.key !== key)) throw notFound();
    const row = await TenantContext.runSystem(() => prisma.cmsEntry.findUnique({ where: { id: p.entryId }, include }));
    const dto = row ? this.present(row, locale, true) : null;
    if (!dto) throw notFound();
    return dto;
  }

  /** `GET /cms?type=page&category=features&lang=` — published entries of one type (sorted like the admin list). */
  async list(q: CmsListQuery, locale: Locale): Promise<CmsListItemDto[]> {
    if (!(PUBLIC_TYPES as readonly string[]).includes(q.type)) return [];
    const rows = await TenantContext.runSystem(() =>
      prisma.cmsEntry.findMany({ where: { ...this.live(new Date()), type: q.type, ...(q.category ? { category: q.category } : {}) }, include, orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
    );
    return rows
      .map((r) => {
        const d = this.present(r, q.lang ?? locale, false);
        return d ? { key: d.key, type: d.type, category: d.category, locale: d.locale, requestedLocale: d.requestedLocale, fallback: d.fallback, title: d.title, body: d.body, version: d.version, publishedAt: d.publishedAt, sortOrder: r.sortOrder } : null;
      })
      .filter((x): x is CmsListItemDto => !!x);
  }
}
