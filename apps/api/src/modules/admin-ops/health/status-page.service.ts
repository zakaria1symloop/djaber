// OPS-06 / PUB status (06 §12, api-contract §3.14 StatusPageDto): components with their state and 90-day uptime computed
// from the incidents, the incident history of 90 days, the incident banner and the maintenance window; e-mail
// subscription with a confirmation link (always 202: no address enumeration).
import { Injectable } from '@nestjs/common';
import { algiersDay, algiersDayStart } from '../../../core/time/algiers';
import { createHash } from 'node:crypto';
import { prisma, type Incident, type StatusSubscriber } from '@djaber/db';
import { STATUS_COMPONENTS, type StatusPageDto } from '@djaber/shared';
import { ConfigService } from '../../../core/config/config.service';
import { CryptoService } from '../../../core/crypto/crypto.service';
import { notFound } from '../../../core/errors/app.exception';
import { I18nService } from '../../../core/i18n/i18n.service';
import { MailOutbox } from '../../../core/mail/mail.outbox';
import { pick, sys } from '../admin-ops.util';

const DAY = 86400_000;
const WINDOW_MS = 90 * DAY;
type ComponentState = 'operational' | 'degraded' | 'incident';
const RANK: Record<ComponentState, number> = { operational: 0, degraded: 1, incident: 2 };

/** Unsubscribe token of a subscriber: `<id>.<digest of its secret hash>` (no extra column, never guessable). */
export const unsubscribeToken = (s: Pick<StatusSubscriber, 'id' | 'tokenHash'>) => `${s.id}.${createHash('sha256').update(`${s.tokenHash}:unsubscribe`).digest('hex').slice(0, 32)}`;

/** Total minutes covered by a set of intervals inside [from, to] (overlaps merged). */
export const coveredMs = (intervals: { start: number; end: number }[], from: number, to: number): number => {
  const clipped = intervals.map((i) => ({ start: Math.max(i.start, from), end: Math.min(i.end, to) })).filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  let total = 0;
  let cur: { start: number; end: number } | null = null;
  for (const i of clipped) {
    if (!cur || i.start > cur.end) {
      if (cur) total += cur.end - cur.start;
      cur = { ...i };
    } else cur.end = Math.max(cur.end, i.end);
  }
  if (cur) total += cur.end - cur.start;
  return total;
};

/** OPS-06 uptime: 100 × (1 − downtime / 90 d) where downtime = major / critical incidents listing the component. */
export const uptime90d = (incidents: Pick<Incident, 'components' | 'severity' | 'startedAt' | 'resolvedAt'>[], key: string, now = Date.now()) => {
  const down = incidents.filter((i) => i.components.includes(key) && (i.severity === 'major' || i.severity === 'critical')).map((i) => ({ start: i.startedAt.getTime(), end: i.resolvedAt?.getTime() ?? now }));
  return Math.round((1 - coveredMs(down, now - WINDOW_MS, now) / WINDOW_MS) * 10000) / 100;
};

/** One state per Africa/Algiers day of the last 90 days, oldest first (PUB status bars): worst incident touching the day. */
export const dailyStates = (incidents: Pick<Incident, 'components' | 'severity' | 'startedAt' | 'resolvedAt'>[], key: string, now = Date.now()): ('ok' | 'degraded' | 'incident')[] => {
  const mine = incidents.filter((i) => i.components.includes(key));
  const todayStart = algiersDayStart(algiersDay(new Date(now))).getTime();
  const out: ('ok' | 'degraded' | 'incident')[] = [];
  for (let d = 89; d >= 0; d--) {
    const start = todayStart - d * 86400_000;
    const end = start + 86400_000;
    const hits = mine.filter((i) => i.startedAt.getTime() < end && (i.resolvedAt?.getTime() ?? now) > start);
    out.push(hits.some((i) => i.severity === 'critical') ? 'incident' : hits.length ? 'degraded' : 'ok');
  }
  return out;
};

type MaintenanceValue = { enabled?: boolean; from?: string | null; to?: string | null; scheduledFrom?: string | null; scheduledTo?: string | null; scope?: string; text?: Record<string, string> | null } | null;

@Injectable()
export class StatusPageService {
  constructor(
    private readonly i18n: I18nService,
    private readonly crypto: CryptoService,
    private readonly mail: MailOutbox,
    private readonly config: ConfigService,
  ) {}

  async page(locale: string, now = new Date()): Promise<StatusPageDto> {
    return sys(async () => {
      const since = new Date(now.getTime() - WINDOW_MS);
      const [incidents, banner, maintenance] = await Promise.all([
        prisma.incident.findMany({ where: { OR: [{ startedAt: { gte: since } }, { resolvedAt: null }, { resolvedAt: { gte: since } }] }, include: { updates: { orderBy: { at: 'desc' } } }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }] }),
        prisma.platformSetting.findUnique({ where: { key: 'incident_banner' } }),
        prisma.platformSetting.findUnique({ where: { key: 'maintenance' } }),
      ]);
      const open = incidents.filter((i) => i.status !== 'resolved');
      const components = STATUS_COMPONENTS.map((key) => {
        const hits = open.filter((i) => i.components.includes(key));
        const status: ComponentState = hits.some((i) => i.severity === 'critical') ? 'incident' : hits.length ? 'degraded' : 'operational';
        return { key, name: this.i18n.t(locale, `opsApi.status.component.${key}`), status, uptime90d: uptime90d(incidents, key, now.getTime()), days: dailyStates(incidents, key, now.getTime()) };
      });
      const overall = components.reduce<ComponentState>((w, c) => (RANK[c.status] > RANK[w] ? c.status : w), open.some((i) => i.severity === 'critical') ? 'incident' : open.length ? 'degraded' : 'operational');
      const b = banner?.value as { visible?: boolean; text?: Record<string, string> | null } | null;
      const m = maintenance?.value as MaintenanceValue;
      const from = m?.scheduledFrom ?? m?.from ?? null;
      const to = m?.scheduledTo ?? m?.to ?? null;
      const enabled = !!m && m.enabled !== false && (m.enabled === true || !!from);
      const active = enabled && (!from || Date.parse(from) <= now.getTime()) && (!to || now.getTime() < Date.parse(to));
      const upcoming = enabled && !!from && Date.parse(from) > now.getTime();
      return {
        overall,
        components,
        incidents: incidents.map((i) => ({
          id: i.id,
          title: pick(i.title, locale),
          status: i.status,
          severity: i.severity,
          components: i.components,
          startedAt: i.startedAt.toISOString(),
          resolvedAt: i.resolvedAt?.toISOString() ?? null,
          durationMinutes: i.resolvedAt ? Math.round((i.resolvedAt.getTime() - i.startedAt.getTime()) / 60_000) : null,
          updates: i.updates.map((u) => ({ at: u.at.toISOString(), status: u.status, body: pick(u.body, locale) })),
        })),
        banner: b?.visible && b.text ? pick(b.text, locale) || null : null,
        maintenance: active || upcoming ? { active, scheduledFrom: from, scheduledTo: to, scope: m?.scope ?? 'all', text: m?.text ? pick(m.text, locale) || null : null } : null,
        updatedAt: now.toISOString(),
      };
    });
  }

  /** `POST /status/subscribe` — new or re-subscribing address ⇒ confirmation e-mail; an active subscriber gets nothing. */
  async subscribe(email: string, locale: 'fr' | 'ar' | 'en') {
    await sys(async () => {
      const existing = await prisma.statusSubscriber.findUnique({ where: { email } });
      if (existing?.verifiedAt && !existing.unsubscribedAt) return;
      const token = this.crypto.randomToken();
      const tokenHash = this.crypto.sha256(token);
      const row = existing
        ? await prisma.statusSubscriber.update({ where: { email }, data: { tokenHash, locale, verifiedAt: null, unsubscribedAt: null } })
        : await prisma.statusSubscriber.create({ data: { email, tokenHash, locale } });
      const web = this.config.get('PUBLIC_WEB_URL').replace(/\/$/, '');
      await this.mail.send({ to: email, template: 'status/subscribe-confirm', locale, key: `status-subscribe:${row.id}:${tokenHash.slice(0, 16)}`, params: {}, secret: { url: `${web}/${locale}/status/confirm/${token}` } });
    });
    return { accepted: true };
  }

  async confirm(token: string) {
    return sys(async () => {
      const row = await prisma.statusSubscriber.findFirst({ where: { tokenHash: this.crypto.sha256(token), unsubscribedAt: null } });
      if (!row) throw notFound();
      if (!row.verifiedAt) await prisma.statusSubscriber.update({ where: { id: row.id }, data: { verifiedAt: new Date() } });
      return { email: row.email, subscribed: true, unsubscribeToken: unsubscribeToken(row) };
    });
  }

  async unsubscribe(token: string) {
    return sys(async () => {
      const [id] = token.split('.');
      const row = id && /^[0-9a-f-]{36}$/i.test(id) ? await prisma.statusSubscriber.findUnique({ where: { id } }) : null;
      if (!row || !this.crypto.safeEqual(unsubscribeToken(row), token)) throw notFound();
      if (!row.unsubscribedAt) await prisma.statusSubscriber.update({ where: { id: row.id }, data: { unsubscribedAt: new Date() } });
      return { subscribed: false };
    });
  }
}
