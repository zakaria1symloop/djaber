// D62 / D69 / 06 §8.6 — monthly report e-mails: `POST|DELETE /reports/:key/schedule { email, dayOfMonth }`, `GET
// /reports/schedules` (plan feature `scheduled_reports` ⇒ else 403 PLAN_FEATURE_REQUIRED). 03-events §4
// `sched-report-schedules` (07:00): every schedule whose day is today gets one `jobs/report-schedule-send` job
// (id `report-schedule:<scheduleId>:<YYYY-MM>`) that renders last month's report (PDF + XLSX) and e-mails it through the
// outbox (attachments ≤ 10 MB, else signed links valid 7 days). Workspaces without the feature are skipped silently.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { isReportKey, type ReportKey, type ReportScheduleInput, type ReportScheduleView } from '@djaber/shared';
import { prisma, TenantContext, type ReportSchedule } from '@djaber/db';
import { ConfigService } from '../../../core/config/config.service';
import { AppException, notFound } from '../../../core/errors/app.exception';
import { MailOutbox } from '../../../core/mail/mail.outbox';
import type { MailAttachment } from '../../../core/mail/mail.service';
import { ProcessorRegistry } from '../../../core/queue/processor.registry';
import { QueueService } from '../../../core/queue/queue.service';
import { StorageService } from '../../../core/storage/storage.service';
import { TenantResolver } from '../../../core/tenancy/tenant.resolver';
import { algiersClock, algiersDay } from '../../../core/time/algiers';
import type { ExportFile } from '../../jobs/export.service';
import { addDays } from '../../analytics/range';

export const SCHEDULED_REPORTS_FEATURE = 'scheduled_reports';
const ATTACH_MAX_BYTES = 10 * 1024 * 1024;
const LINK_TTL_S = 7 * 24 * 3600;
type Lang = 'fr' | 'ar' | 'en';
type Renderer = (key: ReportKey, from: string, to: string, locale: Lang) => Promise<{ title: string; fileName: string; rows: number; files: ExportFile[] }>;

const DELIVERY = {
  attached: { fr: 'en pièces jointes (PDF et Excel)', ar: 'في المرفقات (PDF وExcel)', en: 'attached (PDF and Excel)' },
  links: { fr: 'à télécharger pendant 7 jours : {links}', ar: 'للتنزيل لمدة 7 أيام: {links}', en: 'download within 7 days: {links}' },
} as const;
const MONTHS: Record<Lang, string[]> = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  ar: ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** Previous calendar month of an Algiers day: `{ month: YYYY-MM, from, to }`. */
export const previousMonth = (day: string) => {
  const [y, m] = day.split('-').map(Number) as [number, number];
  const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
  const from = `${py}-${String(pm).padStart(2, '0')}-01`;
  const to = addDays(`${y}-${String(m).padStart(2, '0')}-01`, -1);
  return { month: from.slice(0, 7), from, to };
};

@Injectable()
export class ReportScheduleService implements OnModuleInit {
  private readonly log = new Logger(ReportScheduleService.name);
  private renderer: Renderer | null = null;
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly queue: QueueService,
    private readonly tenants: TenantResolver,
    private readonly mail: MailOutbox,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.registry.cron('sched-report-schedules', '0 7 * * *', () => this.scheduleDue());
    this.registry.register('jobs', 'report-schedule-send', (d: { scheduleId: string; month: string }) => this.send(d.scheduleId, d.month), { concurrency: 1 });
  }

  /** ReportService hands its file renderer over (avoids a provider cycle). */
  bindRenderer(fn: Renderer) {
    this.renderer = fn;
  }

  /** Next sending day (Africa/Algiers): this month's day if not passed yet (before 07:00 counts), else next month's. */
  nextRunOn(dayOfMonth: number, now: Date = new Date()) {
    const today = algiersDay(now);
    const thisMonth = `${today.slice(0, 7)}-${String(dayOfMonth).padStart(2, '0')}`;
    if (thisMonth > today || (thisMonth === today && algiersClock(now).hour < 7)) return thisMonth;
    const next = addDays(`${today.slice(0, 7)}-28`, 7).slice(0, 7);
    return `${next}-${String(dayOfMonth).padStart(2, '0')}`;
  }

  private async view(s: ReportSchedule & { createdBy?: { id: string; firstName: string; lastName: string } | null }): Promise<ReportScheduleView> {
    return {
      id: s.id,
      reportKey: s.reportKey as ReportKey,
      email: s.email,
      dayOfMonth: s.dayOfMonth,
      createdAt: s.createdAt.toISOString(),
      createdBy: s.createdBy ? { id: s.createdBy.id, name: `${s.createdBy.firstName} ${s.createdBy.lastName}`.trim() } : null,
      nextRunOn: this.nextRunOn(s.dayOfMonth),
    };
  }

  async list(reportKey?: ReportKey): Promise<ReportScheduleView[]> {
    const rows = await prisma.reportSchedule.findMany({
      where: reportKey ? { reportKey } : {},
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ reportKey: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(rows.map((r) => this.view(r)));
  }

  private async assertFeature() {
    if (!(await this.tenants.hasFeature(TenantContext.workspaceId(), SCHEDULED_REPORTS_FEATURE))) throw new AppException('PLAN_FEATURE_REQUIRED', { feature: SCHEDULED_REPORTS_FEATURE });
  }

  /** `POST /reports/:key/schedule` — one row per workspace × report × e-mail; a second POST updates the day. */
  async upsert(key: string, input: ReportScheduleInput): Promise<{ view: ReportScheduleView; created: boolean }> {
    if (!isReportKey(key)) throw notFound();
    await this.assertFeature();
    const t = TenantContext.get();
    const email = input.email.toLowerCase();
    const existing = await prisma.reportSchedule.findFirst({ where: { reportKey: key, email } });
    const row = existing
      ? await prisma.reportSchedule.update({ where: { id: existing.id }, data: { dayOfMonth: input.dayOfMonth }, include: { createdBy: { select: { id: true, firstName: true, lastName: true } } } })
      : await prisma.reportSchedule.create({ data: { workspaceId: t.workspaceId, reportKey: key, email, dayOfMonth: input.dayOfMonth, createdById: t.userId! }, include: { createdBy: { select: { id: true, firstName: true, lastName: true } } } });
    return { view: await this.view(row), created: !existing };
  }

  /** `DELETE /reports/:key/schedule { email }` — always allowed (stopping needs no plan). */
  async remove(key: string, email: string | undefined) {
    if (!isReportKey(key) || !email) throw notFound();
    const r = await prisma.reportSchedule.deleteMany({ where: { reportKey: key, email: email.toLowerCase() } });
    if (!r.count) throw notFound();
  }

  /** Cron `sched-report-schedules`: schedules due today (a day beyond the month's end = its last day). */
  async scheduleDue(now: Date = new Date()) {
    const today = algiersDay(now);
    const day = Number(today.slice(8));
    const last = previousMonth(addDays(`${today.slice(0, 7)}-28`, 7)).to === today;
    const due = await TenantContext.runSystem(() => prisma.reportSchedule.findMany({ where: last ? { dayOfMonth: { gte: day } } : { dayOfMonth: day }, select: { id: true } }));
    const { month } = previousMonth(today);
    for (const s of due) await this.queue.add('jobs', 'report-schedule-send', { scheduleId: s.id, month }, `report-schedule:${s.id}:${month}`, { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } });
    return { due: due.length, month };
  }

  /** Job `jobs/report-schedule-send`: renders and e-mails last month's report. A rerun sends nothing new (outbox key). */
  async send(scheduleId: string, month: string) {
    const s = await TenantContext.runSystem(() => prisma.reportSchedule.findUnique({ where: { id: scheduleId }, include: { workspace: { select: { id: true, name: true, locale: true, deletedAt: true, status: true } } } }));
    if (!s || s.workspace.deletedAt || s.workspace.status !== 'active' || !isReportKey(s.reportKey)) return { sent: false };
    if (!(await this.tenants.hasFeature(s.workspaceId, SCHEDULED_REPORTS_FEATURE))) return { sent: false, reason: 'feature' };
    if (!this.renderer) throw new Error('report renderer not bound');
    const tenant = await this.tenants.forWorker(s.workspaceId);
    const locale = (s.workspace.locale as Lang) ?? 'fr';
    const from = `${month}-01`;
    const to = previousMonth(addDays(`${month}-28`, 7)).to;
    return TenantContext.run(tenant, async () => {
      const out = await this.renderer!(s.reportKey as ReportKey, from, to, locale);
      const stored: (MailAttachment & { size: number })[] = [];
      for (const f of out.files) {
        const storageKey = `private/ws/${s.workspaceId}/reports/scheduled/${s.id}-${month}.${f.ext}`;
        await this.storage.put(storageKey, f.body, f.mime);
        stored.push({ fileName: `${out.fileName}.${f.ext}`, storageKey, mime: f.mime, size: f.body.length });
      }
      const attach = stored.reduce((sum, f) => sum + f.size, 0) <= ATTACH_MAX_BYTES;
      const [y, m] = month.split('-').map(Number) as [number, number];
      const links = stored.map((f) => `${f.fileName} ${this.storage.signedUrl(f.storageKey, LINK_TTL_S)}`).join(' · ');
      await this.mail.send({
        to: s.email,
        template: 'reports/scheduled',
        locale,
        key: `report-schedule:${s.id}:${month}`,
        workspaceId: s.workspaceId,
        params: {
          report: out.title,
          period: `${MONTHS[locale][m - 1]} ${y}`,
          workspaceName: s.workspace.name,
          delivery: attach ? DELIVERY.attached[locale] : DELIVERY.links[locale].replace('{links}', links),
          rows: out.rows,
          url: `${this.config.get('PUBLIC_WEB_URL').replace(/\/$/, '')}/${locale}/reports/${s.reportKey}?from=${from}&to=${to}`,
        },
        ...(attach ? { attachments: stored } : {}),
      });
      this.log.log({ scheduleId: s.id, month, attach }, 'scheduled report queued');
      return { sent: true, attach };
    });
  }
}

