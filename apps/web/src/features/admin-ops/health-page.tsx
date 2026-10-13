'use client';
// /admin/health — Figma "ADM-14 — Platform admin — jobs & health (queues, Meta webhooks, AI runs, incidents)" (975:40325):
// KPI tiles, BullMQ queues table (state OK / ATTENTION / INCIDENT / PAUSE, one Actions ⌄ per row), recent failures (DLQ:
// payload + trace + Rejouer), incidents (OUVERT / RÉSOLU, updates, post-mortem), Meta webhooks 24 h. Reads
// `admin.health.read` (every platform role); pause / resume / drain / replay-all / run-now / incidents
// `admin.health.write` (super_admin); replay one failed job `admin.health.replay` (super_admin + support).
import { formatDateTime, formatNumber, type FailedJobDto, type HealthDto, type IncidentDto, type QueueHealthDto } from '@djaber/shared';
import {
  ActionsMenu,
  Button,
  buttonClass,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Ltr,
  OpsKpiStrip,
  OpsKpiTile,
  OpsPanel,
  Skeleton,
  StatePill,
  toast,
  type Column,
  type MenuAction,
} from '@djaber/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { OfflineBanner } from '@/components/global-states';
import { AdminPage, AdminQueryError } from '@/features/admin/admin-page';
import { usePlatform } from '@/features/admin/platform';
import { useOffline } from '@/features/orders/offline';
import { errorMessage } from '@/lib/forms';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useWsEvent } from '@/lib/ws';
import { opsApi, opsKeys, useFailedJobs, useHealth, useIncidents } from './api';
import { useLocalized } from './common';
import { backlogQueue, p95, queueState } from './logic';
import { DeclareIncidentDialog, IncidentDialog } from './incident-dialogs';

const MONITORING_URL = process.env.NEXT_PUBLIC_MONITORING_URL ?? '';
type QueueAction = 'pause' | 'resume' | 'drain-failed' | 'replay-failed' | 'run-now';

export function HealthPage() {
  const t = useT();
  const locale = useLocaleCode() as 'fr' | 'ar' | 'en';
  const qc = useQueryClient();
  const offline = useOffline();
  const { can } = usePlatform();
  const health = useHealth();
  const failed = useFailedJobs((health.data?.queues ?? []).filter((q) => q.failed > 0).map((q) => q.name));
  const incidents = useIncidents();
  const [declare, setDeclare] = useState(false);
  const [openIncident, setOpenIncident] = useState<string | null>(null);
  const [openJob, setOpenJob] = useState<{ id: string; queue: string } | null>(null);
  const [schedulers, setSchedulers] = useState(false);
  const [confirm, setConfirm] = useState<{ queue: QueueHealthDto; action: QueueAction } | null>(null);
  const [busy, setBusy] = useState(false);
  useWsEvent('health.updated', () => void qc.invalidateQueries({ queryKey: opsKeys.health }));

  const canWrite = can('admin.health.write');
  const writeReason = offline ? t('banner.offline') : undefined;
  const since = health.dataUpdatedAt ? formatDateTime(new Date(health.dataUpdatedAt), locale) : '—';

  const runQueue = async (queue: QueueHealthDto, action: QueueAction, cron?: string) => {
    setBusy(true);
    try {
      await opsApi.queueAction(queue.name, action, cron);
      toast({ tone: 'success', message: t(`adminHealth.queue.done.${action}`, { queue: queue.name }) });
      setConfirm(null);
      await Promise.all([qc.invalidateQueries({ queryKey: opsKeys.health }), qc.invalidateQueries({ queryKey: opsKeys.failed() })]);
    } catch (e) {
      toast({ tone: 'danger', message: errorMessage(e, t) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      permission="admin.health.read"
      title={t('nav.admin.health')}
      description={t('adminHealth.description')}
      actions={
        <>
          {MONITORING_URL ? (
            <a href={MONITORING_URL} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'ghost' })}>
              {t('adminHealth.monitoring')}
            </a>
          ) : (
            <Button variant="ghost" disabledReason={t('adminHealth.monitoring.unset')}>
              {t('adminHealth.monitoring')}
            </Button>
          )}
          {canWrite ? (
            <Button className="!border-accent-alert/60 !text-accent-alert hover:!border-accent-alert" onClick={() => setDeclare(true)} disabledReason={writeReason} data-testid="incident-declare">
              {t('adminHealth.incident.declare')}
            </Button>
          ) : null}
        </>
      }
    >
      {offline && health.data ? <OfflineBanner since={since} onRetry={() => void health.refetch()} /> : null}
      {health.isPending ? (
        <HealthSkeleton />
      ) : health.isError && !health.data ? (
        <AdminQueryError error={health.error} onRetry={() => void health.refetch()} />
      ) : health.data ? (
        <>
          <HealthKpis data={health.data} />
          <OpsPanel title={t('adminHealth.queues.title')} data-testid="queues">
            <QueuesTable
              data={health.data}
              canWrite={canWrite}
              writeReason={writeReason}
              onAction={(queue, action) => (action === 'drain-failed' || action === 'replay-failed' || action === 'pause' ? setConfirm({ queue, action }) : action === 'run-now' ? setSchedulers(true) : void runQueue(queue, action))}
            />
          </OpsPanel>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <OpsPanel title={t('adminHealth.dlq.title')} sub={t('adminHealth.dlq.sub')} data-testid="dlq">
              <FailedList jobs={failed.data} error={failed.error} pending={failed.isPending} onRetry={() => void failed.refetch()} onOpen={setOpenJob} />
            </OpsPanel>
            <OpsPanel title={t('adminHealth.incidents.title')} sub={t('adminHealth.incidents.sub')} data-testid="incidents">
              <IncidentList rows={incidents.data?.rows} error={incidents.error} pending={incidents.isPending} onRetry={() => void incidents.refetch()} onOpen={setOpenIncident} />
            </OpsPanel>
          </div>
          <MetaWebhooks data={health.data} />
        </>
      ) : null}

      <DeclareIncidentDialog open={declare} onClose={() => setDeclare(false)} onDone={(i) => setOpenIncident(i.id)} />
      <IncidentDialog id={openIncident} onClose={() => setOpenIncident(null)} />
      <FailedJobDialog job={openJob} onClose={() => setOpenJob(null)} canReplay={can('admin.health.replay')} offline={offline} />
      {health.data ? <SchedulersDialog open={schedulers} data={health.data} onClose={() => setSchedulers(false)} offline={offline} /> : null}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? t(`adminHealth.queue.confirm.${confirm.action}.title`, { queue: confirm.queue.name }) : ''}
        description={confirm ? t(`adminHealth.queue.confirm.${confirm.action}.description`, { count: confirm.queue.failed }) : undefined}
        confirmLabel={confirm ? t(`adminHealth.queue.action.${confirm.action}`, { count: confirm.queue.failed }) : ''}
        cancelLabel={t('action.cancel')}
        closeLabel={t('action.close')}
        destructive={confirm?.action === 'drain-failed'}
        loading={busy}
        onConfirm={() => confirm && void runQueue(confirm.queue, confirm.action)}
      />
    </AdminPage>
  );
}

function HealthSkeleton() {
  const t = useT();
  return (
    <div aria-busy="true" aria-label={t('common.loading')} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

/* ---------- KPI tiles ---------- */
function HealthKpis({ data }: { data: HealthDto }) {
  const t = useT();
  const locale = useLocaleCode() as 'fr' | 'ar' | 'en';
  const backlog = backlogQueue(data.queues);
  const open = data.incidents.filter((i) => i.status !== 'resolved');
  const ack = data.metaWebhooks.ackUnder1sPct;
  return (
    <OpsKpiStrip label={t('adminHealth.kpi.label')}>
      <OpsKpiTile
        data-testid="kpi-ack"
        context={t('adminHealth.kpi.ack.context', { late: formatNumber(data.metaWebhooks.ackOver5s) })}
        value={ack === null ? '—' : `${formatPct(ack)} %`}
        unit={t('adminHealth.kpi.ack.unit')}
      />
      <OpsKpiTile
        data-testid="kpi-backlog"
        context={backlog ? (backlog.note ? `${backlog.name} (${backlog.note})` : backlog.name) : '—'}
        value={formatNumber(backlog ? backlog.waiting + backlog.delayed : 0)}
        unit={t('adminHealth.kpi.backlog.unit')}
        tone={backlog && backlog.state === 'incident' ? 'danger' : undefined}
      />
      <OpsKpiTile
        data-testid="kpi-ai"
        context={data.ai.failoverActive ? t('adminHealth.kpi.ai.failover') : t('adminHealth.kpi.ai.threshold', { pct: formatPct(data.ai.thresholdPct) })}
        value={`${formatPct(data.ai.errorRate24hPct)} %`}
        unit={t('adminHealth.kpi.ai.unit', { provider: data.ai.provider })}
        tone={data.ai.errorRate24hPct > data.ai.thresholdPct ? 'warning' : undefined}
      />
      <OpsKpiTile data-testid="kpi-duplicates" context={t('adminHealth.kpi.duplicates.context')} value={formatNumber(data.duplicates7d)} unit={t('adminHealth.kpi.duplicates.unit')} tone={data.duplicates7d > 0 ? 'danger' : undefined} />
      <OpsKpiTile
        data-testid="kpi-incidents"
        context={open[0] ? t('adminHealth.kpi.incidents.context', { title: open[0].title, time: formatDateTime(open[0].startedAt, locale) }) : t('adminHealth.kpi.incidents.none')}
        value={formatNumber(open.length)}
        unit={t('adminHealth.kpi.incidents.unit', { count: open.length })}
        tone={open.length ? 'danger' : undefined}
      />
    </OpsKpiStrip>
  );
}
const formatPct = (n: number) => (Math.round(n * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/* ---------- Queues table ---------- */
function QueuesTable({ data, canWrite, writeReason, onAction }: { data: HealthDto; canWrite: boolean; writeReason?: string; onAction: (q: QueueHealthDto, a: QueueAction) => void }) {
  const t = useT();
  const p95Label = (q: QueueHealthDto) => {
    const v = p95(q);
    return v.kind === 'none' ? '—' : v.kind === 'min' ? t('adminHealth.p95.min', { value: v.value }) : t('adminHealth.p95.s', { value: v.value.toLocaleString('fr-FR') });
  };
  const columns: Column<QueueHealthDto>[] = [
    { key: 'name', header: t('adminHealth.col.queue'), cell: (q) => <span className="font-medium">{q.name}</span>, hideable: false },
    { key: 'waiting', header: t('adminHealth.col.waiting'), cell: (q) => formatNumber(q.waiting), ltr: true },
    { key: 'active', header: t('adminHealth.col.active'), cell: (q) => formatNumber(q.active), ltr: true },
    { key: 'failed', header: t('adminHealth.col.failed'), cell: (q) => <span className={q.failed ? 'text-accent-alert' : undefined}>{formatNumber(q.failed)}</span>, ltr: true },
    { key: 'delayed', header: t('adminHealth.col.delayed'), cell: (q) => formatNumber(q.delayed), ltr: true, hideBelow: 'lg' },
    { key: 'p95', header: t('adminHealth.col.p95'), cell: p95Label, ltr: true, hideBelow: 'lg' },
    {
      key: 'state',
      header: t('adminHealth.col.state'),
      cell: (q) => (
        <StatePill state={queueState(q)}>
          {t(`adminHealth.state.${q.state}`)}
          {q.note ? ` · ${q.note}` : ''}
        </StatePill>
      ),
    },
  ];
  const actions = (q: QueueHealthDto): MenuAction[] => {
    if (!canWrite) return [];
    const noFailed = q.failed === 0 ? t('adminHealth.queue.noFailed') : undefined;
    const out: MenuAction[] = [
      q.state === 'paused'
        ? { key: 'resume', label: t('adminHealth.queue.action.resume'), onSelect: () => onAction(q, 'resume'), disabledReason: writeReason }
        : { key: 'pause', label: t('adminHealth.queue.action.pause'), onSelect: () => onAction(q, 'pause'), disabledReason: writeReason ?? (q.pausable ? undefined : t('adminHealth.queue.notPausable')) },
      { key: 'replay-failed', label: t('adminHealth.queue.action.replay-failed', { count: q.failed }), onSelect: () => onAction(q, 'replay-failed'), disabledReason: writeReason ?? noFailed },
      { key: 'drain-failed', label: t('adminHealth.queue.action.drain-failed', { count: q.failed }), onSelect: () => onAction(q, 'drain-failed'), disabledReason: writeReason ?? noFailed, destructive: true },
    ];
    if (q.name === 'scheduler' && data.schedulers.length) out.push({ key: 'run-now', label: t('adminHealth.queue.action.run-now'), onSelect: () => onAction(q, 'run-now'), disabledReason: writeReason, separated: true });
    return out.map((a) => (a.disabledReason ? { ...a, onSelect: undefined } : a));
  };
  if (!data.queues.length) return <EmptyState title={t('adminHealth.queues.empty')} />;
  return (
    <DataTable
      label={t('adminHealth.queues.title')}
      columns={columns}
      rows={data.queues}
      rowKey={(q) => q.name}
      density="compact"
      actionsLabel={t('action.actions')}
      rowActions={canWrite ? (q) => <ActionsMenu label={t('action.actions')} heading={q.name} actions={actions(q)} /> : undefined}
      card={(q) => (
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <div className="truncate font-medium">{q.name}</div>
            <div className="ts-label-micro text-text-muted">
              <Ltr>
                {formatNumber(q.waiting)} · {formatNumber(q.active)} · {formatNumber(q.failed)}
              </Ltr>
            </div>
          </div>
          <StatePill state={queueState(q)}>{t(`adminHealth.state.${q.state}`)}</StatePill>
          {canWrite ? <ActionsMenu label={t('action.actions')} heading={q.name} actions={actions(q)} /> : null}
        </div>
      )}
    />
  );
}

/* ---------- Recent failures (DLQ) ---------- */
function FailedList({ jobs, error, pending, onRetry, onOpen }: { jobs: FailedJobDto[] | undefined; error: unknown; pending: boolean; onRetry: () => void; onOpen: (job: { id: string; queue: string }) => void }) {
  const t = useT();
  const locale = useLocaleCode() as 'fr' | 'ar' | 'en';
  if (pending) return <Skeleton className="h-40" />;
  if (!jobs) return <AdminQueryError error={error} onRetry={onRetry} />;
  if (!jobs.length) return <EmptyState title={t('adminHealth.dlq.empty')} />;
  return (
    <ul className="divide-y divide-line-hairline rounded-card border border-line-edge">
      {jobs.map((j) => (
        <li key={j.id}>
          <button type="button" onClick={() => onOpen({ id: j.id, queue: j.queue })} data-job={j.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-ink-raised/60">
            <Ltr className="w-12 shrink-0 ts-label-micro text-text-muted">{formatDateTime(j.finishedOn ?? j.timestamp, locale).slice(-5)}</Ltr>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">
                {j.queue} · {j.name}
              </span>
              <span className="block truncate ts-label-micro !normal-case text-accent-alert">{j.failedReason ?? '—'}</span>
            </span>
            <span className="shrink-0 ts-label-meta text-accent-inbound">{t('adminHealth.dlq.replay')}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function FailedJobDialog({ job: ref, onClose, canReplay, offline }: { job: { id: string; queue: string } | null; onClose: () => void; canReplay: boolean; offline: boolean }) {
  const id = ref?.id ?? null;
  const queue = ref?.queue ?? '';
  const t = useT();
  const locale = useLocaleCode() as 'fr' | 'ar' | 'en';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: opsKeys.failedJob(id ?? '', queue), queryFn: () => opsApi.failedJob(id ?? '', queue), enabled: !!id });
  const job = id ? (q.data ?? null) : null;
  const [replayError, setError] = useState<string | null>(null);
  const error = replayError ?? (q.error ? errorMessage(q.error, t) : null);
  const [busy, setBusy] = useState(false);
  const replay = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await opsApi.replayJob(id, queue);
      toast({ tone: 'success', message: t('adminHealth.dlq.replayed') });
      await Promise.all([qc.invalidateQueries({ queryKey: opsKeys.failed() }), qc.invalidateQueries({ queryKey: opsKeys.health })]);
      onClose();
    } catch (e) {
      setError(`${errorMessage(e, t)}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!id}
      onOpenChange={(o) => {
        if (!o) {
          setError(null);
          onClose();
        }
      }}
      title={job ? `${job.queue} · ${job.name}` : t('adminHealth.dlq.title')}
      description={job ? t('adminHealth.dlq.meta', { attempts: job.attemptsMade, at: formatDateTime(job.finishedOn ?? job.timestamp, locale), replays: job.replays }) : undefined}
      closeLabel={t('action.close')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('action.close')}
          </Button>
          {canReplay ? (
            <Button variant="primary" onClick={() => void replay()} loading={busy} disabledReason={offline ? t('banner.offline') : !job ? t('common.loading') : undefined} data-testid="job-replay">
              {t('adminHealth.dlq.replay')}
            </Button>
          ) : null}
        </>
      }
    >
      {error ? <p className="mb-3 text-[13px] text-accent-alert" role="alert">{error}</p> : null}
      {!job && !error ? <Skeleton className="h-40" /> : null}
      {job ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-accent-alert">{job.failedReason ?? '—'}</p>
          <div>
            <div className="mb-1 ts-label-micro text-text-muted">{t('adminHealth.dlq.payload')}</div>
            <pre dir="ltr" className="max-h-48 overflow-auto rounded-card bg-ink-raised p-3 text-[12px] text-text-secondary">
              {JSON.stringify(job.data, null, 2)}
            </pre>
          </div>
          <div>
            <div className="mb-1 ts-label-micro text-text-muted">{t('adminHealth.dlq.trace')}</div>
            <pre dir="ltr" className="max-h-48 overflow-auto rounded-card bg-ink-raised p-3 text-[11px] text-text-muted">
              {job.stacktrace.length ? job.stacktrace.join('\n') : '—'}
            </pre>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

/* ---------- Incidents ---------- */
function IncidentList({ rows, error, pending, onRetry, onOpen }: { rows: IncidentDto[] | undefined; error: unknown; pending: boolean; onRetry: () => void; onOpen: (id: string) => void }) {
  const t = useT();
  const locale = useLocaleCode() as 'fr' | 'ar' | 'en';
  const pick = useLocalized();
  if (pending) return <Skeleton className="h-40" />;
  if (!rows) return <AdminQueryError error={error} onRetry={onRetry} />;
  if (!rows.length) return <EmptyState title={t('adminHealth.incidents.empty')} />;
  return (
    <ul className="divide-y divide-line-hairline rounded-card border border-line-edge">
      {rows.map((i) => {
        const open = i.status !== 'resolved';
        return (
          <li key={i.id}>
            <button type="button" onClick={() => onOpen(i.id)} data-incident={i.id} data-status={i.status} className="flex w-full flex-col gap-1 px-3 py-2.5 text-start hover:bg-ink-raised/60">
              <span className="flex flex-wrap items-center gap-2">
                <StatePill state={open ? 'incident' : 'ok'}>
                  {t(open ? 'adminHealth.incident.open' : 'adminHealth.incident.resolved')} ·{' '}
                  <Ltr>{open ? formatDateTime(i.startedAt, locale) : `${formatDateTime(i.startedAt, locale)} → ${i.resolvedAt ? formatDateTime(i.resolvedAt, locale).slice(-5) : '—'}`}</Ltr>
                </StatePill>
                <span className="text-[14px]">{pick(i.title)}</span>
              </span>
              <span className="ts-label-micro !normal-case text-text-muted">
                {[
                  i.affectedWorkspaces !== null ? t('adminHealth.incident.affected', { count: i.affectedWorkspaces }) : null,
                  i.bannerVisible ? t('adminHealth.incident.bannerOn') : null,
                  i.postMortem ? t('adminHealth.incident.postMortem') : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || t(`adminHealth.severity.${i.severity}`)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Meta webhooks 24 h ---------- */
function MetaWebhooks({ data }: { data: HealthDto }) {
  const t = useT();
  const m = data.metaWebhooks;
  const s = (ms: number | null) => (ms === null ? '—' : t('adminHealth.p95.s', { value: (Math.round(ms / 100) / 10).toLocaleString('fr-FR') }));
  return (
    <OpsPanel title={t('adminHealth.meta.title')} sub={t('adminHealth.meta.sub')} data-testid="meta-webhooks">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OpsKpiTile
          context={t('adminHealth.meta.received.context', { messages: formatNumber(m.byType.messages), postbacks: formatNumber(m.byType.postbacks), reads: formatNumber(m.byType.reads) })}
          value={formatNumber(m.received24h)}
          unit={t('adminHealth.meta.received.unit')}
        />
        <OpsKpiTile context={t('adminHealth.meta.signatures.context')} value={formatNumber(m.invalidSignatures)} unit={t('adminHealth.meta.signatures.unit')} tone={m.invalidSignatures ? 'danger' : undefined} />
        <OpsKpiTile context={t('adminHealth.meta.late.context', { deduped: formatNumber(m.dedupedCount) })} value={formatNumber(m.ackOver5s)} unit={t('adminHealth.meta.late.unit')} tone={m.ackOver5s ? 'warning' : undefined} />
        <OpsKpiTile context={t('adminHealth.meta.reply.context', { p95: s(m.p95Ms) })} value={s(m.medianToReplyMs)} unit={t('adminHealth.meta.reply.unit')} />
      </div>
    </OpsPanel>
  );
}

/* ---------- "Lancer maintenant" — the cron tasks of the `scheduler` queue (03-events §4) ---------- */
function SchedulersDialog({ open, data, onClose, offline }: { open: boolean; data: HealthDto; onClose: () => void; offline: boolean }) {
  const t = useT();
  const locale = useLocaleCode() as 'fr' | 'ar' | 'en';
  const qc = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (cron: string) => {
    setRunning(cron);
    setError(null);
    try {
      await opsApi.queueAction('scheduler', 'run-now', cron);
      toast({ tone: 'success', message: t('adminHealth.queue.done.run-now', { queue: cron }) });
      await qc.invalidateQueries({ queryKey: opsKeys.health });
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setRunning(null);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={t('adminHealth.schedulers.title')} description={t('adminHealth.schedulers.sub')} closeLabel={t('action.close')} size="lg">
      {error ? (
        <p role="alert" className="mb-3 text-[13px] text-accent-alert">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-line-hairline rounded-card border border-line-edge" data-testid="schedulers">
        {data.schedulers.map((s) => (
          <li key={s.name} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[13px]" dir="ltr">
                {s.name}
              </span>
              <span className="block ts-label-micro !normal-case text-text-muted">
                <Ltr>{s.pattern}</Ltr> · {s.nextRunAt ? t('adminHealth.schedulers.next', { at: formatDateTime(s.nextRunAt, locale) }) : '—'}
              </span>
            </span>
            <Button size="sm" onClick={() => void run(s.name)} loading={running === s.name} disabledReason={offline ? t('banner.offline') : running && running !== s.name ? t('common.loading') : undefined} data-cron={s.name}>
              {t('adminHealth.queue.action.run-now')}
            </Button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
