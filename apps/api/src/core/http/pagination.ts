// 09-code-conventions §2.2 (page size per api-contract §1.6: 25 / 50 / 100, default 25)
import type { PageQuery } from '@djaber/shared';

export type Page<T> = { data: T[]; page: number; pageSize: number; total: number };
export type CursorPage<T> = { data: T[]; nextCursor: string | null };
export type BulkResult = { id: string; ok: boolean; code?: string; params?: Record<string, unknown> };

export const isPage = (b: unknown): b is Page<unknown> =>
  !!b && typeof b === 'object' && 'data' in b && 'total' in b && 'pageSize' in b;

export const toSkipTake = (q: Pick<PageQuery, 'page' | 'pageSize'>) => ({
  skip: (q.page - 1) * q.pageSize,
  take: q.pageSize,
});

export const toOrderBy = (
  q: Pick<PageQuery, 'sort'>,
  allowed: readonly string[],
  fallback = '-createdAt',
): Record<string, 'asc' | 'desc'>[] => {
  const s = q.sort && allowed.includes(q.sort.replace(/^-/, '')) ? q.sort : fallback;
  const field = s.replace(/^-/, '');
  const dir = s.startsWith('-') ? 'desc' : 'asc';
  // ties broken by id (08-coder-playbook §6 "Sort")
  return field === 'id' ? [{ id: dir }] : [{ [field]: dir }, { id: 'desc' }];
};

export const page = <T>(data: T[], total: number, q: Pick<PageQuery, 'page' | 'pageSize'>): Page<T> => ({
  data,
  total,
  page: q.page,
  pageSize: q.pageSize,
});
