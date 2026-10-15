// `?job=<id>` on a screen (notifications `job_finished` / `job_failed`, Home queue "task" cards): what the banner of
// that job says. Pure (unit tested); the component is `components/job-param-banner.tsx`.
import type { JobDto } from './jobs';

export type JobBannerState =
  'loading' | 'running' | 'done' | 'partial' | 'failed' | 'cancelled' | 'missing';

/** `missing` = the job cannot be read any more (expired, deleted, another workspace: 404). */
export function jobBannerState(
  job: Pick<JobDto, 'status'> | null | undefined,
  unreadable: boolean,
): JobBannerState {
  if (unreadable) return 'missing';
  if (!job) return 'loading';
  if (job.status === 'queued' || job.status === 'running') return 'running';
  return job.status;
}

export const JOB_BANNER_TONE: Record<JobBannerState, 'info' | 'success' | 'warning' | 'danger'> = {
  loading: 'info',
  running: 'info',
  done: 'success',
  partial: 'warning',
  failed: 'danger',
  cancelled: 'warning',
  missing: 'warning',
};

/** The URL without `job` (closing the banner); the other parameters of the screen are kept. */
export function withoutJobParam(pathname: string, search: string): string {
  const p = new URLSearchParams(search);
  p.delete('job');
  const rest = p.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
