// 06-api "Notifications" — `GET|PUT /notification-preferences` (NTF-02), every member (`notifications.own`).
import { Body, Controller, Get, Put } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { UpdateNotificationPreferencesSchema } from '@djaber/shared';
import { RequirePermission } from '../../core/auth/decorators';
import { NotificationFanoutService } from './notification-fanout.service';

class UpdateNotificationPreferencesDto extends createZodDto(UpdateNotificationPreferencesSchema) {}

@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly fanout: NotificationFanoutService) {}

  @Get()
  @RequirePermission('notifications.own')
  list() {
    return this.fanout.list();
  }

  @Put()
  @RequirePermission('notifications.own')
  update(@Body() dto: UpdateNotificationPreferencesDto) {
    return this.fanout.update(dto);
  }
}
