// CAT-07 — "Créer depuis une photo": `POST /products/ai-fill` (multipart, 1–5 photos).
// The AI fills only the fields the form left empty (name, description, category, unit) and never a price.
// Exception of 03-events §7: this handler waits for the provider (the dialog shows "Analyse…").
import { Inject, Injectable } from '@nestjs/common';
import { prisma, TenantContext } from '@djaber/db';
import { AI_FILL_MAX_PHOTOS, PRODUCT_IMAGE_MAX_BYTES } from '@djaber/shared';
import { AppException, validationError } from '../../core/errors/app.exception';
import { RedisService } from '../../core/redis/redis.provider';
import { algiersDay } from '../../core/time/algiers';
import type { UploadedFile } from '../uploads/image-upload.service';
import { PRODUCT_VISION_PROVIDER, type ProductVisionProvider } from './ai.providers';

const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
/** 07-non-functional §3 `analysis`: 3 / day / workspace (page analysis, agent generation, FAQ extract, create-from-photo). */
const DAILY_LIMIT = 3;
const empty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export type AiFillCurrent = { name?: string; description?: string; categoryId?: string; unitId?: string };
export type AiFillResult = {
  /** null = the form already had a value: left untouched */
  name: string | null;
  description: string | null;
  categoryId: string | null;
  unitId: string | null;
  attributes: Record<string, string>;
  filled: ('name' | 'description' | 'categoryId' | 'unitId')[];
};

@Injectable()
export class AiFillService {
  constructor(
    @Inject(PRODUCT_VISION_PROVIDER) private readonly vision: ProductVisionProvider,
    private readonly redis: RedisService,
  ) {}

  async fill(files: UploadedFile[] | undefined, current: AiFillCurrent, locale: string): Promise<AiFillResult> {
    const photos = files ?? [];
    if (!photos.length) throw validationError({ photos: 'validation.required' });
    if (photos.length > AI_FILL_MAX_PHOTOS) throw validationError({ photos: 'validation.length' });
    for (const f of photos) {
      if (!MIMES.has(f.mimetype)) throw new AppException('IMAGE_TYPE_INVALID', {}, { photos: 'validation.invalid' });
      if (f.size > PRODUCT_IMAGE_MAX_BYTES) throw new AppException('IMAGE_TOO_LARGE', {}, { photos: 'validation.invalid' });
    }
    const t = TenantContext.get();
    const key = `rl:analysis:${t.workspaceId}:${algiersDay()}`;
    const used = await this.redis.client.incr(key);
    if (used === 1) await this.redis.client.expire(key, 26 * 3600);
    if (used > DAILY_LIMIT) throw new AppException('ANALYSIS_RATE_LIMITED');

    const [categories, units] = await Promise.all([
      prisma.category.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
      prisma.unit.findMany({ where: { OR: [{ workspaceId: null }, { workspaceId: t.workspaceId }] }, select: { id: true, name: true, abbreviation: true }, orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }] }),
    ]);
    let suggestion;
    try {
      suggestion = await this.vision.describe({
        photos: photos.map((f) => ({ buffer: f.buffer, mime: f.mimetype, fileName: f.originalname ?? 'photo' })),
        locale,
        categories: categories.map((c) => c.name),
        units: units.map((u) => u.name),
      });
    } catch (e) {
      // a failed analysis does not consume the daily allowance
      await this.redis.client.decr(key);
      throw e;
    }
    const same = (a: string, b: string | null) => !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
    const category = categories.find((c) => same(c.name, suggestion.category));
    const unit = units.find((u) => same(u.name, suggestion.unit) || same(u.abbreviation, suggestion.unit));
    const out: AiFillResult = {
      name: empty(current.name) ? suggestion.name.slice(0, 255) : null,
      description: empty(current.description) ? suggestion.description.slice(0, 5000) : null,
      categoryId: empty(current.categoryId) ? (category?.id ?? null) : null,
      unitId: empty(current.unitId) ? (unit?.id ?? null) : null,
      attributes: suggestion.attributes,
      filled: [],
    };
    for (const k of ['name', 'description', 'categoryId', 'unitId'] as const) if (out[k] !== null) out.filled.push(k);
    return out;
  }
}
