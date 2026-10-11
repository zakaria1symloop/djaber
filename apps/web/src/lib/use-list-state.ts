'use client';
// `useListState(spec)` — the one hook that keeps a list in the URL: search, filters, status tab, sort, page, page size,
// density, layout, hidden columns and the open side sheet (`?sheet=<id>`). Shareable links, back navigation and
// refresh restore the same view. Used by every L6 list (products, movements, services; orders / clients / delivery later).
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import {
  clearListFilters,
  countActiveFilters,
  filtersApiQuery,
  formatSort,
  hasActiveFilters,
  listApiQuery,
  listQueryString,
  parseListState,
  parseSort,
  patchListState,
  type ApiQuery,
  type Density,
  type FilterValue,
  type ListSpec,
  type ListState,
} from './list-state';
import { useSession } from './session';

export type ListPatch = Parameters<typeof patchListState>[1];

export function useListState(spec: ListSpec) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { me } = useSession();
  const state = useMemo(() => parseListState(spec, params), [spec, params]);

  const write = useCallback(
    (next: ListState, mode: 'replace' | 'push' = 'replace') => {
      const qs = listQueryString(spec, next, params.entries());
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === 'push') router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [spec, params, pathname, router],
  );

  const set = useCallback((patch: ListPatch) => write(patchListState(state, patch)), [state, write]);
  const setFilter = useCallback((name: string, value: FilterValue | null | undefined) => write(patchListState(state, { filters: { [name]: value } })), [state, write]);
  const setFilters = useCallback((filters: Record<string, FilterValue | null | undefined>) => write(patchListState(state, { filters })), [state, write]);
  const clear = useCallback(() => write(clearListFilters(state)), [state, write]);
  /** opening a sheet is a history entry: Back closes it */
  const openSheet = useCallback((id: string | null) => write({ ...state, sheet: id }, id && !state.sheet ? 'push' : 'replace'), [state, write]);

  const density: Density = state.density ?? me?.prefs?.listDensity ?? 'comfortable';
  return {
    state,
    set,
    setFilter,
    setFilters,
    clear,
    openSheet,
    density,
    sort: parseSort(state.sort),
    setSort: (s: { key: string; dir: 'asc' | 'desc' }) => set({ sort: formatSort(s) }),
    activeCount: countActiveFilters(state),
    filtered: hasActiveFilters(state),
    /** parameters of `GET <list>` */
    apiQuery: (extra?: ApiQuery) => listApiQuery(state, extra),
    /** parameters of `GET <list>/stats` and of exports */
    filterQuery: (extra?: ApiQuery) => filtersApiQuery(state, extra),
  };
}
export type ListController = ReturnType<typeof useListState>;
