// 03-events-and-jobs §3 `jobs/export` — one generic export job: a registered source turns the stored filters into a table,
// the file is written under `private/` (signed URL, 24 h) and linked to the `Job` row (kept 7 days, D62).
import { Injectable, OnModuleInit } from '@nestjs/common';
import { prisma, TenantContext, type Job } from '@djaber/db';
import { AppException } from '../../core/errors/app.exception';
import { ProcessorRegistry } from '../../core/queue/processor.registry';
import { StorageService } from '../../core/storage/storage.service';
import { JobService } from './job.service';
import { writeTable, type TableColumn, type TableFormat } from './table-file';

export type ExportTable<T = any> = { sheetName: string; fileName: string; columns: TableColumn<T>[]; rows: T[] };
/** Runs in the tenant scope of the job's workspace, as the user who asked for the export. */
export type ExportSource = (filters: Record<string, unknown>, ctx: { locale: 'fr' | 'ar' | 'en'; jobId: string }) => Promise<ExportTable>;
export type ExportKind = 'products' | 'movements' | 'orders' | 'clients' | 'report' | 'audit' | 'ledger' | 'conversation-eval';

const EXPORT_TTL_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class ExportService implements OnModuleInit {
  private readonly sources = new Map<string, ExportSource>();
  constructor(
    private readonly jobs: JobService,
    private readonly registry: ProcessorRegistry,
    private readonly storage: StorageService,
  ) {}

  onModuleInit() {
    this.registry.register('jobs', 'export', (data: { jobId: string }) => this.process(data.jobId), { concurrency: 2 });
  }

  /** Feature modules declare what they can export (`products`, `movements`, later `orders`, `clients`, reports…). */
  registerSource(kind: ExportKind, source: ExportSource) {
    this.sources.set(kind, source);
  }

  /** `202 { jobId }` — the file is produced by the worker. */
  async request(kind: ExportKind, filters: Record<string, unknown>, format: TableFormat = 'xlsx') {
    const t = TenantContext.get();
    const job = await this.jobs.create({
      kind: 'export',
      name: 'export',
      payload: { kind, filters, format, locale: t.locale },
      expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
    });
    return { jobId: job.id };
  }

  /** Job handler. A second run of a finished job is a no-op (JobService.run). */
  async process(jobId: string) {
    await this.jobs.run(jobId, async (job: Job) => {
      const p = (job.payload ?? {}) as { kind?: string; filters?: Record<string, unknown>; format?: TableFormat; locale?: 'fr' | 'ar' | 'en' };
      const source = p.kind ? this.sources.get(p.kind) : undefined;
      if (!source) throw new AppException('REPORT_EXPORT_FAILED');
      const t = TenantContext.get();
      const table = await source(p.filters ?? {}, { locale: p.locale ?? t.locale, jobId });
      if (await this.jobs.isCancelled(jobId)) return;
      const file = writeTable(p.format === 'csv' ? 'csv' : 'xlsx', table.sheetName, table.columns, table.rows);
      const key = `private/ws/${t.workspaceId}/exports/${jobId}.${file.ext}`;
      await this.storage.put(key, file.body, file.mime);
      const upload = await prisma.upload.create({
        data: { workspaceId: t.workspaceId, storageKey: key, url: key, mime: file.mime, size: file.body.length, kind: 'export', createdById: job.createdById! },
      });
      return { resultUploadId: upload.id, result: { kind: p.kind, rows: table.rows.length, format: file.ext, fileName: `${table.fileName}.${file.ext}`, size: file.body.length } };
    });
  }
}
