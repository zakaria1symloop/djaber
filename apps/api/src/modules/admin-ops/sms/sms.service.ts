// SMS channel of the notification fan-out: only `invoice_unpaid` (dunning J0 / J+3, 04 §14 "+ SMS when enabled") and only
// while `PlatformProvider(key='sms')` is usable (`status=ok` or `config.enabled=true`). The text is queued (`outbox /
// sms-send`, job id `sms:<notificationId>`) and sent to the recipient's `User.phone` through the SMS port.
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { normalizePhoneDz } from '@djaber/shared';
import { prisma, TenantContext, type Notification, type Tx } from '@djaber/db';
import { ProcessorRegistry } from '../../../core/queue/processor.registry';
import { QueueOutbox } from '../../../core/queue/queue.outbox';
import { renderNotification } from '../../notifications/notification.catalog';
import { NotificationProducer, type FanoutRecipient } from '../../notifications/notification.producer';
import { maskMsisdn, SMS_GATEWAY, type SmsGateway } from './sms.gateway';

export const SMS_TYPES = new Set(['invoice_unpaid']);

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly log = new Logger(SmsService.name);
  constructor(
    private readonly producer: NotificationProducer,
    private readonly registry: ProcessorRegistry,
    private readonly queue: QueueOutbox,
    @Inject(SMS_GATEWAY) readonly gateway: SmsGateway,
  ) {}

  onModuleInit() {
    this.producer.registerChannel({ name: 'sms', deliver: (row, recipient) => this.queueSms(row, recipient) });
    this.registry.register('outbox', 'sms-send', (d: { notificationId: string; userId: string }) => this.send(d), { concurrency: 4 });
  }

  /** The `sms` provider is usable: health `ok`, or explicitly enabled in its config. */
  async providerEnabled(): Promise<boolean> {
    const p = await TenantContext.runSystem(() => prisma.platformProvider.findUnique({ where: { key: 'sms' } }));
    if (!p) return false;
    const cfg = (p.config ?? {}) as Record<string, unknown>;
    return p.status === 'ok' || p.status === 'warning' || cfg.enabled === true;
  }

  private async queueSms(row: Notification, recipient: FanoutRecipient) {
    if (!SMS_TYPES.has(row.type) || !(await this.providerEnabled())) return;
    await this.queue.add(prisma as unknown as Tx, 'outbox', 'sms-send', { workspaceId: row.workspaceId, notificationId: row.id, userId: recipient.id }, `sms:${row.id}`, { attempts: 3, backoff: { type: 'exponential', delay: 30_000 } });
  }

  /** Job `outbox / sms-send`: idempotent per notification (job id); a user without a valid phone is skipped. */
  async send(d: { notificationId: string; userId: string }) {
    return TenantContext.runSystem(async () => {
      const [n, user] = await Promise.all([prisma.notification.findUnique({ where: { id: d.notificationId } }), prisma.user.findUnique({ where: { id: d.userId }, select: { phone: true, locale: true } })]);
      if (!n || !user?.phone) return { sent: false, reason: 'no_phone' };
      const to = normalizePhoneDz(user.phone);
      const locale = user.locale === 'ar' || user.locale === 'en' ? user.locale : 'fr';
      const { title, body } = renderNotification(n.type, (n.data ?? {}) as Record<string, unknown>, locale);
      const r = await this.gateway.send({ to, text: `Djaber — ${title}. ${body}`.slice(0, 320), tag: n.type });
      if (!r.ok) {
        this.log.warn({ to: maskMsisdn(to), error: r.error }, 'sms not sent');
        if (r.error === 'UNAVAILABLE') throw new Error('sms provider unavailable');
        return { sent: false, reason: r.error };
      }
      return { sent: true };
    });
  }
}
