'use client';
// Server-searched pickers of the admin dialogs: workspace (GET /admin/workspaces?q) and plan (GET /admin/plans).
import type { AdminWorkspaceRowDto } from '@djaber/shared';
import { Combobox } from '@djaber/ui';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { useAdminList } from './api';

export function WorkspacePicker({ id, value, onChange, invalid, initialLabel }: { id?: string; value: string | null; onChange: (id: string | null, ws: { id: string; name: string } | null) => void; invalid?: boolean; initialLabel?: string }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const h = window.setTimeout(() => setDebounced(q), 300);
    return () => window.clearTimeout(h);
  }, [q]);
  const list = useAdminList<AdminWorkspaceRowDto>('/admin/workspaces', { ...(debounced.trim().length >= 2 ? { q: debounced.trim() } : {}), pageSize: 25 });
  const rows = list.data?.rows ?? [];
  const options = rows.map((w) => ({ value: w.id, label: w.name, hint: w.plan.name }));
  if (value && initialLabel && !options.some((o) => o.value === value)) options.unshift({ value, label: initialLabel, hint: '' });
  return (
    <Combobox
      id={id}
      value={value}
      onChange={(v, o) => onChange(v, v && o ? { id: v, name: o.label } : null)}
      options={options}
      placeholder={t('admin.picker.workspace')}
      searchPlaceholder={t('admin.picker.workspaceSearch')}
      emptyLabel={t('admin.picker.none')}
      onSearch={setQ}
      loading={list.isFetching}
      invalid={invalid}
    />
  );
}
