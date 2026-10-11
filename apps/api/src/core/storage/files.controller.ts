import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { AppException } from '../errors/app.exception';
import { ConfigService } from '../config/config.service';
import { StorageService } from './storage.service';

/** Serves objects of the `local` storage driver (dev / test). With `s3` the public URL points at the bucket/CDN. */
@Controller('files')
export class FilesController {
  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('*key')
  async get(@Param('key') key: string | string[], @Query('exp') exp: string, @Query('sig') sig: string, @Res() res: any) {
    if (this.config.get('STORAGE_DRIVER') !== 'local') throw new AppException('NOT_FOUND');
    const k = Array.isArray(key) ? key.join('/') : key;
    if (k.startsWith('private/')) {
      const e = Number(exp);
      if (!e || e < Date.now() / 1000 || sig !== this.storage.sign(k, e)) throw new AppException('NOT_FOUND');
    }
    try {
      const { body, mime } = await this.storage.get(k);
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', k.startsWith('private/') ? 'private, no-store' : 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(body);
    } catch {
      throw new AppException('NOT_FOUND');
    }
  }
}
