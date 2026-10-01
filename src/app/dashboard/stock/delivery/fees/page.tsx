'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { ChevronLeftIcon, SearchIcon, RefreshIcon } from '@/components/ui/icons';
import {
  getDeliveryFeeRules,
  upsertDeliveryFeeRule,
  seedDeliveryFees,
  deleteDeliveryFeeRule,
  type DeliveryFeeRule,
} from '@/lib/user-stock-api';
import { useTranslation } from '@/contexts/LanguageContext';

export default function DeliveryFeesPage() {
  const router = useRouter();
  const { t: tr } = useTranslation();
  const [rules, setRules] = useState<DeliveryFeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<number, { home?: number; stopdesk?: number; return?: number }>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getDeliveryFeeRules();
      setRules(res.rules);
      setEdits({});
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : tr('stk.ops.fees.loadFailed') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter(
      (r) => r.name.toLowerCase().includes(q) || r.code.includes(q) || r.nameAr.includes(q)
    );
  }, [rules, search]);

  const setEdit = (wilayaId: number, field: 'home' | 'stopdesk' | 'return', value: number) => {
    setEdits((prev) => ({
      ...prev,
      [wilayaId]: { ...prev[wilayaId], [field]: value },
    }));
  };

  const saveRow = async (r: DeliveryFeeRule) => {
    const edit = edits[r.wilayaId];
    try {
      setSaving(r.wilayaId);
      await upsertDeliveryFeeRule({
        wilayaId: r.wilayaId,
        homePrice: edit?.home ?? r.homePrice,
        stopdeskPrice: edit?.stopdesk ?? r.stopdeskPrice,
        returnPrice: edit?.return ?? r.returnPrice,
      });
      setToast({ type: 'success', msg: tr('stk.ops.fees.rowSaved').replace('{name}', r.name) });
      setEdits((p) => { const { [r.wilayaId]: _, ...rest } = p; return rest; });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : tr('stk.ops.fees.saveFailed') });
    } finally {
      setSaving(null);
    }
  };

  const resetRow = async (r: DeliveryFeeRule) => {
    if (!r.isCustom) return;
    try {
      setSaving(r.wilayaId);
      await deleteDeliveryFeeRule(r.wilayaId);
      setToast({ type: 'success', msg: tr('stk.ops.fees.rowReset').replace('{name}', r.name) });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : tr('stk.ops.fees.resetFailed') });
    } finally {
      setSaving(null);
    }
  };

  const seedAll = async (overwrite: boolean) => {
    if (overwrite && !confirm(tr('stk.ops.fees.overwriteConfirm'))) return;
    try {
      setLoading(true);
      const r = await seedDeliveryFees(overwrite);
      setToast({ type: 'success', msg: tr('stk.ops.fees.seeded').replace('{n}', String(r.seeded)) });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : tr('stk.ops.fees.seedFailed') });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.push('/dashboard/stock/delivery')}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          {tr('stk.ops.fees.back')}
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              {tr('stk.ops.fees.title')}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              {tr('stk.ops.fees.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => seedAll(false)}>
              <RefreshIcon className="w-4 h-4" />
              {tr('stk.ops.fees.fillMissing')}
            </Button>
            <Button variant="secondary" onClick={() => seedAll(true)}>
              {tr('stk.ops.fees.resetAll')}
            </Button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-xl p-3 text-sm border ${
            toast.type === 'success'
              ? 'bg-white/[0.03] border-white/10 text-zinc-300'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('stk.ops.fees.search')}
            className="w-full pl-10 pr-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-zinc-500 text-sm">{tr('stk.ops.c.loading')}</div>
        ) : (
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-800/50 text-start text-xs font-medium text-zinc-400">
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">{tr('stk.ops.fees.wilaya')}</th>
                  <th className="px-4 py-2.5 text-end">{tr('stk.ops.fees.home')}</th>
                  <th className="px-4 py-2.5 text-end">{tr('stk.ops.fees.stopdesk')}</th>
                  <th className="px-4 py-2.5 text-end">{tr('stk.ops.fees.return')}</th>
                  <th className="px-4 py-2.5 text-end">{tr('stk.ops.c.source')}</th>
                  <th className="px-4 py-2.5 w-40"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const edit = edits[r.wilayaId] || {};
                  const dirty = edit.home !== undefined || edit.stopdesk !== undefined || edit.return !== undefined;
                  return (
                    <tr key={r.wilayaId} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-xs text-zinc-500">{r.code}</td>
                      <td className="px-4 py-2 text-sm text-white">
                        {r.name}
                        <span className="text-xs text-zinc-500 ms-2">{r.nameAr}</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          value={edit.home ?? r.homePrice}
                          onChange={(e) => setEdit(r.wilayaId, 'home', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-black border border-white/10 rounded text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          value={edit.stopdesk ?? r.stopdeskPrice}
                          onChange={(e) => setEdit(r.wilayaId, 'stopdesk', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-black border border-white/10 rounded text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          value={edit.return ?? r.returnPrice}
                          onChange={(e) => setEdit(r.wilayaId, 'return', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-black border border-white/10 rounded text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-[10px] uppercase text-zinc-300">
                          {r.isCustom ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full border border-zinc-600" />
                          )}
                          {r.isCustom ? tr('stk.ops.fees.custom') : tr('stk.ops.fees.default')}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {dirty && (
                            <button
                              onClick={() => saveRow(r)}
                              disabled={saving === r.wilayaId}
                              className="px-3 py-1 bg-white text-black text-xs font-medium rounded hover:bg-zinc-200 disabled:opacity-50"
                            >
                              {saving === r.wilayaId ? '…' : tr('stk.ops.c.save')}
                            </button>
                          )}
                          {r.isCustom && !dirty && (
                            <button
                              onClick={() => resetRow(r)}
                              disabled={saving === r.wilayaId}
                              className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-zinc-700 disabled:opacity-50"
                            >
                              {tr('stk.ops.c.reset')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
