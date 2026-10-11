// api-contract §1.10 — images ≤ 5 MB (jpeg / png / webp / gif), re-encoded with sharp (EXIF stripped) before storage.
// M1 uses it for avatars and workspace logos; later milestones add the other `UploadKind`s.
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { prisma, TenantContext, type UploadKind } from '@djaber/db';
import { AppException, validationError } from '../../core/errors/app.exception';
import { StorageService } from '../../core/storage/storage.service';

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const SHARP_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif']);
/** Square-ish identity pictures: 512 px is enough for every place they are shown. */
const MAX_EDGE: Partial<Record<UploadKind, number>> = { avatar: 512, logo: 512 };

export type UploadedFile = { buffer: Buffer; mimetype: string; size: number; originalname?: string };
export type UploadResult = { id: string; url: string; mime: string; size: number; width: number | null; height: number | null };

@Injectable()
export class ImageUploadService {
  constructor(private readonly storage: StorageService) {}

  async store(file: UploadedFile | undefined, kind: UploadKind, userId: string, workspaceId: string | null): Promise<UploadResult> {
    if (!file?.buffer?.length) throw validationError({ file: 'validation.required' });
    if (!IMAGE_MIMES.has(file.mimetype)) throw new AppException('IMAGE_TYPE_INVALID', {}, { file: 'validation.invalid' });
    if (file.size > IMAGE_MAX_BYTES) throw new AppException('IMAGE_TOO_LARGE', {}, { file: 'validation.invalid' });

    let out: { data: Buffer; info: sharp.OutputInfo };
    try {
      const img = sharp(file.buffer, { failOn: 'error' });
      const meta = await img.metadata();
      // the declared mime type is not trusted: the decoded format decides
      if (!meta.format || !SHARP_FORMATS.has(meta.format)) throw new Error('unsupported format');
      out = await img
        .rotate()
        .resize({ width: MAX_EDGE[kind] ?? 2048, height: MAX_EDGE[kind] ?? 2048, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new AppException('IMAGE_TYPE_INVALID', {}, { file: 'validation.invalid' });
    }

    const key = `${workspaceId ? `ws/${workspaceId}` : `users/${userId}`}/${kind}/${randomUUID()}.webp`;
    const stored = await this.storage.put(key, out.data, 'image/webp');
    const row = await TenantContext.runSystem(() =>
      prisma.upload.create({
        data: { workspaceId, storageKey: key, url: stored.url, mime: 'image/webp', size: out.data.length, kind, createdById: userId },
      }),
    );
    return { id: row.id, url: row.url, mime: row.mime, size: row.size, width: out.info.width ?? null, height: out.info.height ?? null };
  }
}
