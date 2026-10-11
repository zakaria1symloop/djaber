import { Global, Module } from '@nestjs/common';
import { NotificationProducer } from './notification.producer';

/** Producer side only (see notification.producer.ts); the notification centre is built in M5. */
@Global()
@Module({ providers: [NotificationProducer], exports: [NotificationProducer] })
export class NotificationsModule {}
