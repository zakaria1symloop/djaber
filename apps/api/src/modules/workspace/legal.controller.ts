// 06-api §8.1 / §11 — GET /legal/pending · POST /legal/accept { key, version } → 204 (api-contract §3.1)
import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { DevicePlatform } from '@djaber/db';
import { Authenticated, CurrentUser, type AuthUser } from '../../core/auth/decorators';
import { LegalAcceptDto } from './dto';
import { LegalService } from './legal.service';

/** `X-App-Platform: android | ios` on mobile requests (06 §11); anything else is the web. */
export const clientPlatform = (req: any): DevicePlatform => {
  const p = String(req.headers?.['x-app-platform'] ?? '').toLowerCase();
  return p === 'android' || p === 'ios' ? p : 'web';
};

@Controller('legal')
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  @Get('pending')
  @Authenticated()
  pending(@CurrentUser() user: AuthUser) {
    return this.legal.pendingFor(user.id);
  }

  @Post('accept')
  @Authenticated()
  @HttpCode(204)
  async accept(@CurrentUser() user: AuthUser, @Body() dto: LegalAcceptDto, @Req() req: any) {
    await this.legal.accept(user.id, dto.key, dto.version, typeof req.ip === 'string' ? req.ip : null, clientPlatform(req));
  }
}
