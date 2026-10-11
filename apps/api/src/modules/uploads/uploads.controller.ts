// api-contract §1.10 — POST /uploads multipart { file, kind } → { id, url, mime, size, width?, height? }
import { Body, Controller, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { prisma, TenantContext } from '@djaber/db';
import { Authenticated, CurrentUser, type AuthUser } from '../../core/auth/decorators';
import { validationError } from '../../core/errors/app.exception';
import { IMAGE_MAX_BYTES, ImageUploadService, type UploadedFile as Incoming } from './image-upload.service';

/** Multer's own limit sits above the business limit so that the 413 carries the catalogue code (IMAGE_TOO_LARGE). */
export const imageInterceptor = () => FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: IMAGE_MAX_BYTES * 2, files: 1 } });

/** Kinds served by this endpoint so far; the other `UploadKind`s arrive with their milestone. */
const KINDS = ['avatar', 'logo'] as const;
type Kind = (typeof KINDS)[number];

@Controller('uploads')
export class UploadsController {
  constructor(private readonly images: ImageUploadService) {}

  @Post()
  @Authenticated()
  @UseInterceptors(imageInterceptor())
  async upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Incoming | undefined, @Body() body: { kind?: string }, @Req() req: any) {
    const kind = body?.kind as Kind;
    if (!KINDS.includes(kind)) throw validationError({ kind: 'validation.invalid' });
    let workspaceId: string | null = null;
    if (kind === 'logo') {
      // a logo belongs to a workspace the user manages: the header is checked here because the route itself needs no workspace
      const header = req.headers['x-workspace-id'];
      const u = await TenantContext.runSystem(() => prisma.user.findUnique({ where: { id: user.id } }));
      const candidate = typeof header === 'string' && /^[0-9a-f-]{36}$/i.test(header) ? header : (u?.ownedWorkspaceId ?? u?.lastWorkspaceId);
      const membership = candidate
        ? await TenantContext.runSystem(() =>
            prisma.membership.findUnique({ where: { workspaceId_userId: { workspaceId: candidate, userId: user.id } } }),
          )
        : null;
      if (!membership || membership.role === 'operator' || membership.readOnly) throw validationError({ kind: 'validation.invalid' });
      workspaceId = membership.workspaceId;
    }
    return this.images.store(file, kind, user.id, workspaceId);
  }
}
