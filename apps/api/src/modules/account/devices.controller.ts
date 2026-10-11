// 14-mobile-app §6 — POST /me/devices (upsert on token, ≤ 20 per user) · DELETE /me/devices/:token
import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { prisma } from '@djaber/db';
import { localeSchema } from '@djaber/shared';
import { Authenticated, CurrentUser, type AuthUser } from '../../core/auth/decorators';
import { AppException } from '../../core/errors/app.exception';

export const MAX_DEVICES = 20;

const RegisterDevice = z.object({
  token: z.string().trim().min(8).max(4096),
  platform: z.enum(['android', 'ios', 'web']),
  appVersion: z.string().trim().max(30).optional(),
  deviceName: z.string().trim().max(120).nullish(),
  locale: localeSchema.optional(),
});
class RegisterDeviceDto extends createZodDto(RegisterDevice) {}

@Controller('me/devices')
export class DevicesController {
  @Post()
  @Authenticated()
  @HttpCode(200)
  async register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    const existing = await prisma.deviceToken.findUnique({ where: { token: dto.token } });
    if (!existing && (await prisma.deviceToken.count({ where: { userId: user.id } })) >= MAX_DEVICES) {
      throw new AppException('DEVICE_LIMIT', { max: MAX_DEVICES });
    }
    const data = {
      userId: user.id, // a token re-registered by another account moves to that account
      platform: dto.platform,
      appVersion: dto.appVersion ?? null,
      deviceName: dto.deviceName ?? null,
      locale: dto.locale ?? null,
      lastSeenAt: new Date(),
    };
    const row = await prisma.deviceToken.upsert({ where: { token: dto.token }, create: { token: dto.token, ...data }, update: data });
    return {
      token: row.token,
      platform: row.platform,
      appVersion: row.appVersion ?? '',
      deviceName: row.deviceName,
      locale: row.locale ?? 'fr',
      lastSeenAt: row.lastSeenAt.toISOString(),
    };
  }

  @Delete(':token')
  @Authenticated()
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    await prisma.deviceToken.deleteMany({ where: { token, userId: user.id } });
  }
}
