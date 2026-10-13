// Platform-level jobs (no workspace): audit export (signed CSV / JSON), invoices export, CMS AI translation. The row is a
// `Job` with `workspaceId = null`, created by the admin; the worker job `job:<id>` runs in the system scope.
// `GET /admin/jobs/:id` serves the caller's own workspace-less jobs (also the api-b exports).
import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AdminJobDto } from '@djaber/shared';
import { prisma, TenantContext, type Job, type JobKind, type Prisma, type Tx } from '@djaber/db';
import { notFound } from '../../core/errors/app.exception';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { QueueOutbox } from '../../core/queue/queue.outbox';
import { StorageService } from '../../core/storage/storage.service';
import { WsEmitter } from '../../core/ws/ws.emitter';
import { assertUuid, iso } from './admin.util';

const RESULT_TTL_S = 24 * 3600;
export type AdminJobHandler = (job: Job) => Promise<{ result: Record<string, unknown>; file?: { body: Buffer; name: string; mime: string } }>;

@Injectable()
export class AdminJobsService implements OnModuleInit {
  private readonly handlers = new Map<string, AdminJobHandler>();
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly queue: QueueOutbox,
    private readonly storage: StorageService,
    private readonly ws: WsEmitter,
  ) {}

  onModuleInit() {
    for (const name of ['admin-audit-export', 'admin-invoices-export', 'cms-translate']) {
      this.registry.register('jobs', name, (d: { jobId: string }) => this.run(d.jobId), { concurrency: 1 });
    }
  }

  handle(name: string, h: AdminJobHandler) {
    this.handlers.set(name, h);
  }

  async create(kind: JobKind, name: string, payload: Record<string, unknown>, adminId: string): Promise<Job> {
    return TenantContext.runSystem(() =>
      prisma.$transaction(async (db) => {
        const tx = db as Tx;
        const job = await tx.job.create({ data: { workspaceId: null, kind, queue: 'jobs', status: 'queued', payload: { ...payload, name } as Prisma.InputJsonValue, createdById: adminId, expiresAt: new Date(Date.now() + 7 * 24 * 3600_000) } });
        await this.queue.add(tx, 'jobs', name, { jobId: job.id, workspaceId: null }, `job:${job.id}`, { attempts: 1 });
        return job;
      }),
    );
  }

  /** Worker side; running twice is a no-op once the row left `queued|running`. */
  async run(jobId: string) {
    await TenantContext.runSystem(async () => {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job || job.workspaceId || !['queued', 'running'].includes(job.status)) return;
      const name = (job.payload as { name?: string } | null)?.name ?? '';
      const h = this.handlers.get(name);
      if (!h) return;
      await prisma.job.update({ where: { id: jobId }, data: { status: 'running', progress: 5 } });
      try {
        const out = await h(job);
        let resultUploadId: string | null = null;
        if (out.file) {
          const key = `admin/jobs/${job.id}/${out.file.name}`;
          const stored = await this.storage.put(key, out.file.body, out.file.mime);
          const up = await prisma.upload.create({ data: { workspaceId: null, storageKey: key, url: stored.url, mime: out.file.mime, size: out.file.body.length, kind: 'export', createdById: job.createdById! } });
          resultUploadId = up.id;
        }
        await prisma.job.update({ where: { id: jobId }, data: { status: 'done', progress: 100, result: out.result as Prisma.InputJsonValue, resultUploadId } });
      } catch (e) {
        await prisma.job.update({ where: { id: jobId }, data: { status: 'failed', error: JSON.stringify({ code: (e as { code?: string }).code ?? 'INTERNAL' }) } });
      }
      const after = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
      if (after.createdById) this.ws.emit(`user:${after.createdById}`, 'job.updated', { id: jobId, job: { id: jobId, kind: after.kind, status: after.status, progress: after.progress } });
    });
  }

  async get(id: string, adminId: string): Promise<AdminJobDto> {
    assertUuid(id);
    const job = await prisma.job.findFirst({ where: { id, workspaceId: null, createdById: adminId }, include: { resultUpload: true } });
    if (!job) throw notFound();
    let error: { code: string } | null = null;
    if (job.error) {
      try {
        error = { code: (JSON.parse(job.error) as { code?: string }).code ?? 'INTERNAL' };
      } catch {
        error = { code: 'INTERNAL' };
      }
    }
    return {
      id: job.id,
      kind: job.kind,
      status: job.status,
      progress: job.progress,
      result: (job.result as Record<string, unknown> | null) ?? null,
      resultUrl: job.resultUpload ? this.storage.signedUrl(job.resultUpload.storageKey, RESULT_TTL_S) : null,
      error,
      createdAt: job.createdAt.toISOString(),
      finishedAt: ['done', 'failed', 'partial', 'cancelled'].includes(job.status) ? job.updatedAt.toISOString() : null,
      expiresAt: iso(job.expiresAt),
    };
  }
}

export const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
