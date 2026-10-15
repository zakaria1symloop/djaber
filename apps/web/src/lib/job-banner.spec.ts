import { describe, expect, it } from 'vitest';
import { JOB_BANNER_TONE, jobBannerState, withoutJobParam } from './job-banner';

describe('job banner (`?job=` on /delivery and /reports)', () => {
  it('state of the job: loading, running, outcome, or gone', () => {
    expect(jobBannerState(undefined, false)).toBe('loading');
    expect(jobBannerState({ status: 'queued' }, false)).toBe('running');
    expect(jobBannerState({ status: 'running' }, false)).toBe('running');
    expect(jobBannerState({ status: 'done' }, false)).toBe('done');
    expect(jobBannerState({ status: 'partial' }, false)).toBe('partial');
    expect(jobBannerState({ status: 'failed' }, false)).toBe('failed');
    expect(jobBannerState({ status: 'cancelled' }, false)).toBe('cancelled');
    // 404 (expired, another workspace): the banner says so instead of spinning
    expect(jobBannerState(undefined, true)).toBe('missing');
    expect(JOB_BANNER_TONE.failed).toBe('danger');
    expect(JOB_BANNER_TONE.done).toBe('success');
  });
  it('closing removes `job` and keeps the other parameters', () => {
    expect(withoutJobParam('/delivery', 'job=j1')).toBe('/delivery');
    expect(withoutJobParam('/delivery', 'tab=failed&job=j1&ids=o1')).toBe(
      '/delivery?tab=failed&ids=o1',
    );
    expect(withoutJobParam('/reports', '')).toBe('/reports');
  });
});
