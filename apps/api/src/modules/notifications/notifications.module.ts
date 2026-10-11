import { Global, Module } from '@nestjs/common';
import { NotificationProducer } from './notification.producer';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';

/**
 * Producer (in-app rows + WS, fan-out channels plug in with `registerChannel`) and the notification centre endpoints.
 * Preferences, e-mail and push channels arrive with M5.
 */
@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationProducer, NotificationService], exports: [NotificationProducer, NotificationService] })
export class NotificationsModule {}
