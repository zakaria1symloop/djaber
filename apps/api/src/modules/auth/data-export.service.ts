// DEL-01 / FL-22 step 3 — "Exporter mes données": the account's own data as a ZIP (`account.json` + CSV files), job kind
// `data_export` (no workspace: the account may already have left every workspace), signed link valid 7 days.
// `GET /me/data-export` → 202 { jobId } (an export of the last hour is reused) · `GET /me/data-export/:jobId`.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { strToU8, zipSync } from 'fflate';
import { DATA_EXPORT_TTL_DAYS, type DataExportDto } from '@djaber/shared';
import { prisma, TenantContext, type Job, type Tx } from '@djaber/db';
import { notFound } from '../../core/errors/app.exception';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { QueueOutbox } from '../../core/queue/queue.outbox';
import { StorageService } from '../../core/storage/storage.service';

const NAME = 'account-data-export';
const REUSE_MS = 3_600_000;
/** UTF-8 byte order mark: Excel opens the CSV files with the right encoding (Arabic names). */
const BOM = String.fromCharCode(0xfeff);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const csv = (rows: Record<string, unknown>[]): string => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]!);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${BOM}${[cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n')}\r\n`;
};

@Injectable()
export class DataExportService implements OnModuleInit {
  private readonly log = new Logger(DataExportService.name);
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly queue: QueueOutbox,
    private readonly storage: StorageService,
  ) {}

  onModuleInit() {
    this.registry.register('jobs', NAME, (data: { jobId: string }) => this.run(data.jobId));
  }

  /** Starts (or reuses, within an hour) the export of `userId`. */
  async start(userId: string): Promise<{ jobId: string }> {
    return TenantContext.runSystem(async () => {
      const recent = await prisma.job.findFirst({
        where: { workspaceId: null, kind: 'data_export', createdById: userId, createdAt: { gt: new Date(Date.now() - REUSE_MS) }, status: { in: ['queued', 'running', 'done'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (recent) return { jobId: recent.id };
      const job = await prisma.$transaction(async (db) => {
        const tx = db as Tx;
        const j = await tx.job.create({ data: { workspaceId: null, kind: 'data_export', queue: 'jobs', status: 'queued', payload: { name: NAME, userId }, createdById: userId } });
        await this.queue.add(tx, 'jobs', NAME, { jobId: j.id, workspaceId: null }, `job:${j.id}`, { attempts: 1 });
        return j;
      });
      return { jobId: job.id };
    });
  }

  private async dto(job: Job): Promise<DataExportDto> {
    let url: string | null = null;
    if (job.resultUploadId && job.status === 'done' && (!job.expiresAt || job.expiresAt > new Date())) {
      const up = await prisma.upload.findUnique({ where: { id: job.resultUploadId } });
      if (up) url = this.storage.signedUrl(up.storageKey, Math.max(60, Math.floor(((job.expiresAt?.getTime() ?? Date.now() + 86_400_000) - Date.now()) / 1000)));
    }
    return { jobId: job.id, status: job.status, progress: job.progress, url, createdAt: job.createdAt.toISOString(), expiresAt: iso(job.expiresAt) };
  }

  /** Any export job id (deletion flow); null when unknown. */
  async view(jobId: string): Promise<DataExportDto | null> {
    const job = await TenantContext.runSystem(() => prisma.job.findFirst({ where: { id: jobId, kind: 'data_export' } }));
    return job ? TenantContext.runSystem(() => this.dto(job)) : null;
  }

  /** `GET /me/data-export/:jobId` — only the account's own exports. */
  async get(userId: string, jobId: string): Promise<DataExportDto> {
    const job = await TenantContext.runSystem(() => prisma.job.findFirst({ where: { id: jobId, kind: 'data_export', createdById: userId, workspaceId: null } }));
    if (!job) throw notFound();
    return TenantContext.runSystem(() => this.dto(job));
  }

  /** Worker: builds the ZIP. Safe to run twice (a finished job is not rebuilt). */
  async run(jobId: string) {
    await TenantContext.runSystem(async () => {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job || job.kind !== 'data_export' || !['queued', 'running'].includes(job.status) || !job.createdById) return;
      const userId = job.createdById;
      await prisma.job.update({ where: { id: jobId }, data: { status: 'running', progress: 10 } });
      try {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const [memberships, sessions, devices, acceptances, tickets, notifications, deletion, audit] = await Promise.all([
          prisma.membership.findMany({ where: { userId }, include: { workspace: { select: { id: true, name: true } } } }),
          prisma.refreshToken.findMany({ where: { userId }, select: { createdAt: true, expiresAt: true, revokedAt: true, ip: true, userAgent: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
          prisma.deviceToken.findMany({ where: { userId }, select: { platform: true, appVersion: true, deviceName: true, locale: true, lastSeenAt: true, createdAt: true } }),
          prisma.legalAcceptance.findMany({ where: { userId }, include: { document: { select: { key: true } } }, orderBy: { acceptedAt: 'asc' } }),
          prisma.supportTicket.findMany({ where: { userId }, select: { number: true, category: true, status: true, subject: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
          prisma.notification.findMany({ where: { userId }, select: { type: true, title: true, createdAt: true, readAt: true }, orderBy: { createdAt: 'desc' }, take: 1000 }),
          prisma.accountDeletionRequest.findMany({ where: { userId }, select: { source: true, status: true, requestedAt: true, scheduledAt: true, cancelledAt: true } }),
          prisma.auditLog.findMany({ where: { actorId: userId }, select: { at: true, action: true, entity: true, workspaceId: true, ip: true }, orderBy: { at: 'desc' }, take: 1000 }),
        ]);
        const account = {
          exportedAt: new Date().toISOString(),
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, locale: user.locale, status: user.status, emailVerifiedAt: iso(user.emailVerifiedAt), totpEnabled: user.totpEnabled, createdAt: user.createdAt.toISOString(), lastLoginAt: iso(user.lastLoginAt), prefs: user.prefs },
          memberships: memberships.map((m) => ({ workspaceId: m.workspaceId, workspace: m.workspace.name, role: m.role, joinedAt: m.createdAt.toISOString() })),
          deletionRequests: deletion,
        };
        const files: Record<string, Uint8Array> = {
          'account.json': strToU8(JSON.stringify(account, null, 2)),
          'memberships.csv': strToU8(csv(account.memberships)),
          'sessions.csv': strToU8(csv(sessions)),
          'devices.csv': strToU8(csv(devices)),
          'legal-acceptances.csv': strToU8(csv(acceptances.map((a) => ({ document: a.document.key, version: a.version, acceptedAt: a.acceptedAt, client: a.client, ip: a.ip })))),
          'support-tickets.csv': strToU8(csv(tickets)),
          'notifications.csv': strToU8(csv(notifications)),
          'activity.csv': strToU8(csv(audit)),
        };
        const body = Buffer.from(zipSync(files, { level: 6 }));
        const key = `exports/accounts/${userId}/${jobId}.zip`;
        const stored = await this.storage.put(key, body, 'application/zip');
        const upload = await prisma.upload.create({ data: { workspaceId: null, storageKey: key, url: stored.url, mime: 'application/zip', size: body.length, kind: 'export', createdById: userId } });
        await prisma.job.update({ where: { id: jobId }, data: { status: 'done', progress: 100, resultUploadId: upload.id, expiresAt: new Date(Date.now() + DATA_EXPORT_TTL_DAYS * 86_400_000), result: { files: Object.keys(files), size: body.length } } });
      } catch (e) {
        this.log.error({ jobId, err: String(e) }, 'account data export failed');
        await prisma.job.update({ where: { id: jobId }, data: { status: 'failed', error: JSON.stringify({ code: 'INTERNAL' }) } });
      }
    });
  }
}
