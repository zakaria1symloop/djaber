// 06 §12 / 04 §22 — public parcel tracking (`/s/[code]`, QR of the labels): the mapped status timeline only — no
// customer name, phone or address, no amount (only the shop name, the order number, the courier and the tracking
// number). "Signaler ce vendeur": a `Report { type: merchant, reporterKind: end_customer }` (3 / h / IP ⇒ 429
// ABUSE_REPORT_RATE_LIMITED); moderators handle it in M10.
import { Injectable } from '@nestjs/common';
import type { PublicTrackingReportInput, ShipmentStatusName, TrackingPublicView } from '@djaber/shared';
import { prisma, TenantContext } from '@djaber/db';
import { ConfigService } from '../../core/config/config.service';
import { AppException, notFound } from '../../core/errors/app.exception';
import { I18nService } from '../../core/i18n/i18n.service';
import { RedisService } from '../../core/redis/redis.provider';
import { PROVIDER_NAMES, type CourierProvider } from './adapters/courier-adapter';

const REPORT_LIMIT = 3;
const REPORT_WINDOW_S = 3600;

@Injectable()
export class PublicTrackingService {
  constructor(
    private readonly i18n: I18nService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private async byToken(token: string) {
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) throw notFound();
    const s = await TenantContext.runSystem(() =>
      prisma.shipment.findUnique({
        where: { publicTrackingToken: token },
        include: {
          events: { where: { mappedStatus: { not: null } }, orderBy: [{ at: 'desc' }, { createdAt: 'desc' }], take: 50 },
          courierAccount: { select: { displayName: true } },
          order: { select: { number: true, isStopdesk: true, wilaya: { select: { nameFr: true, nameAr: true } } } },
          workspace: { select: { id: true, name: true, status: true } },
        },
      }),
    );
    if (!s || s.workspace.status === 'deletion_scheduled') throw notFound();
    return s;
  }

  /** `GET /track/:publicToken`. */
  async view(token: string, locale: string): Promise<TrackingPublicView> {
    const s = await this.byToken(token);
    const label = (st: string) => this.i18n.t(locale, `enum.Shipment.status.${st}`);
    // consecutive identical statuses collapse into the latest one
    const events: TrackingPublicView['events'] = [];
    for (const e of s.events) {
      const st = e.mappedStatus as ShipmentStatusName;
      if (events.length && events[events.length - 1]!.status === st) continue;
      events.push({ at: e.at.toISOString(), status: st, label: label(st), location: e.location });
    }
    const web = this.config.get('PUBLIC_WEB_URL').replace(/\/$/, '');
    return {
      orderNumber: s.order.number,
      shopName: s.workspace.name,
      status: s.status,
      statusLabel: label(s.status),
      events,
      courier: s.courierAccount?.displayName ?? PROVIDER_NAMES[s.provider as CourierProvider] ?? s.provider,
      trackingNumber: s.trackingNumber,
      wilayaName: s.order.wilaya ? (locale === 'ar' ? s.order.wilaya.nameAr : s.order.wilaya.nameFr) : null,
      isStopdesk: s.order.isStopdesk,
      updatedAt: (s.lastEventAt ?? s.updatedAt).toISOString(),
      reportUrl: `${web}/s/${token}#report`,
    };
  }

  /** `POST /track/:publicToken/report` — "Signaler ce vendeur" (public). */
  async report(token: string, input: PublicTrackingReportInput, ip: string) {
    const key = `rl:track-report:${ip}`;
    const n = await this.redis.client.incr(key);
    if (n === 1) await this.redis.client.expire(key, REPORT_WINDOW_S);
    if (n > REPORT_LIMIT) throw new AppException('ABUSE_REPORT_RATE_LIMITED');
    const s = await this.byToken(token);
    const r = await TenantContext.runSystem(() =>
      prisma.report.create({
        data: { type: 'merchant', reporterKind: 'end_customer', reporterEmail: input.email ?? null, targetWorkspaceId: s.workspace.id, reason: input.reason, details: input.details ?? null, excerpt: { orderNumber: s.order.number, trackingNumber: s.trackingNumber, source: 'public_tracking' } },
        select: { id: true, status: true },
      }),
    );
    return r;
  }
}
