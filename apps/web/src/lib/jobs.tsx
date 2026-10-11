'use client';
// Async jobs (api-contract §1.11): `202 { data: { jobId } }` → `GET /jobs/:id`, kept fresh by WS `job.updated`
// (polling while running, faster when the socket is down). `trackJob` shows the progress toast of exports.
import { toast, updateToast, type ToastInput } from '@djaber/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { api, ApiError, type ApiErrorBody } from './api';
import { useWorkspaceId } from './session';
import { useWsEvent, useWsStatus } from './ws';

export type JobStatus = 'queued' | 'running' | 'done' | 'partial' | 'failed' | 'cancelled';
export type JobDto<R = unknown> = {
  id: string;
  kind: string;
  status: JobStatus;
  /** 0–100 */
  progress: number;
  total: number | null;
  result: R | null;
  resultUrl: string | null;
  error: ApiErrorBody | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};
export type JobRef = { jobId: string };

export const jobKey = (ws: string, id: string) => [ws, 'job', id] as const;
export const isJobRunning = (j: Pick<JobDto, 'status'> | null | undefined) => !j || j.status === 'queued' || j.status === 'running';
export const isJobFinished = (j: Pick<JobDto, 'status'> | null | undefined) => !!j && !isJobRunning(j);

/** WS payload `{ job: { id, status, progress, … } }` merged into the cached job. */
export function useJobEvents() {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  useWsEvent<{ job?: Partial<JobDto> & { id: string } }>('job.updated', (p) => {
    const job = p?.job;
    if (!job?.id) return;
    const key = jobKey(ws, job.id);
    // the event has no `resultUrl` (signed per reader) and may omit the result: a finished job is read from the API,
    // the cached one stays "running" until that answer arrives — otherwise the toast would end without its download
    if (job.status && job.status !== 'queued' && job.status !== 'running') return void qc.invalidateQueries({ queryKey: key });
    const known = qc.getQueryData<JobDto>(key);
    if (known && isJobRunning(known)) qc.setQueryData<JobDto>(key, { ...known, status: job.status ?? known.status, progress: job.progress ?? known.progress });
  });
}

export function useJob<R = unknown>(jobId: string | null | undefined) {
  const ws = useWorkspaceId();
  const live = useWsStatus() === 'connected';
  return useQuery({
    queryKey: jobKey(ws, jobId ?? ''),
    queryFn: () => api<JobDto<R>>(`/jobs/${jobId}`),
    enabled: !!ws && !!jobId,
    staleTime: 0,
    refetchInterval: (q) => (isJobRunning(q.state.data) && !(q.state.error instanceof ApiError) ? (live ? 5_000 : 1_500) : false),
  });
}

/* ---------- job toasts: one sticky toast per tracked job, updated until the job ends ---------- */
type Tracked = {
  jobId: string;
  toastId: number;
  progress: (job: JobDto) => string;
  done: (job: JobDto) => Pick<ToastInput, 'message' | 'action' | 'tone'>;
  failed: (job: JobDto | null, error: unknown) => string;
};
let tracked: Tracked[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Starts following a job with a progress toast ("Export des produits : 40 % (512 lignes)" → "Export terminé · …"). */
export function trackJob(o: Omit<Tracked, 'toastId'> & { started: string }) {
  const toastId = toast({ tone: 'info', message: o.started, progress: null, durationMs: 0 });
  tracked = [...tracked, { jobId: o.jobId, progress: o.progress, done: o.done, failed: o.failed, toastId }];
  emit();
}

function Watcher({ item }: { item: Tracked }) {
  const q = useJob(item.jobId);
  const job = q.data;
  const error = q.error;
  useEffect(() => {
    const stop = () => {
      tracked = tracked.filter((t) => t !== item);
      emit();
    };
    if (error instanceof ApiError) {
      updateToast(item.toastId, { tone: 'danger', message: item.failed(null, error), progress: undefined, durationMs: 8_000 });
      return stop();
    }
    if (!job) return;
    if (isJobRunning(job)) {
      updateToast(item.toastId, { message: item.progress(job), progress: job.progress });
    } else if (job.status === 'done' || job.status === 'partial') {
      updateToast(item.toastId, { tone: job.status === 'done' ? 'success' : 'warning', ...item.done(job), progress: undefined, durationMs: 12_000 });
      stop();
    } else {
      updateToast(item.toastId, { tone: 'danger', message: item.failed(job, null), progress: undefined, durationMs: 8_000 });
      stop();
    }
  }, [job, error, item]);
  return null;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const snapshot = () => tracked;

/** Mounted once in the shell: follows the tracked jobs and keeps the job cache in sync with WS events. */
export function JobToaster() {
  useJobEvents();
  const items = useSyncExternalStore(subscribe, snapshot, snapshot);
  return (
    <>
      {items.map((i) => (
        <Watcher key={i.jobId} item={i} />
      ))}
    </>
  );
}

/** Opens a signed result file (export, error report) without leaving the page. */
export function downloadUrl(url: string, fileName?: string) {
  const a = document.createElement('a');
  a.href = url;
  if (fileName) a.download = fileName;
  a.rel = 'noopener';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
