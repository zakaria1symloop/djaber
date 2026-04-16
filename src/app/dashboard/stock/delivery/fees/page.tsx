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

export default function DeliveryFeesPage() {
  const router = useRouter();
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
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Failed to load' });
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
      setToast({ type: 'success', msg: `${r.name} saved` });
      setEdits((p) => { const { [r.wilayaId]: _, ...rest } = p; return rest; });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(null);
    }
  };

  const resetRow = async (r: DeliveryFeeRule) => {
    if (!r.isCustom) return;
    try {
      setSaving(r.wilayaId);
      await deleteDeliveryFeeRule(r.wilayaId);
      setToast({ type: 'success', msg: `${r.name} reset to default` });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Reset failed' });
    } finally {
      setSaving(null);
    }
  };

  const seedAll = async (overwrite: boolean) => {
    if (overwrite && !confirm('Overwrite all your custom prices with system defaults?')) return;
    try {
      setLoading(true);
      const r = await seedDeliveryFees(overwrite);
      setToast({ type: 'success', msg: `Seeded ${r.seeded} wilayas` });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'Seed failed' });
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
          Back to Delivery
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Delivery Fees
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Set your shipping price per wilaya. Used automatically when creating orders and by the AI agent for Messenger quotes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => seedAll(false)}>
              <RefreshIcon className="w-4 h-4" />
              Fill missing
            </Button>
            <Button variant="secondary" onClick={() => seedAll(true)}>
              Reset all to defaults
            </Button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-xl p-3 text-sm border ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
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
            placeholder="Search wilaya…"
            className="w-full pl-10 pr-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-zinc-500 text-sm">Loading…</div>
        ) : (
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-800/50 text-left text-xs font-medium text-zinc-400">
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Wilaya</th>
                  <th className="px-4 py-2.5 text-right">Home (DA)</th>
                  <th className="px-4 py-2.5 text-right">Stopdesk (DA)</th>
                  <th className="px-4 py-2.5 text-right">Return (DA)</th>
                  <th className="px-4 py-2.5 text-right">Source</th>
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
                        <span className="text-xs text-zinc-500 ml-2">{r.nameAr}</span>
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
                        <span
                          className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${
                            r.isCustom
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-zinc-700/40 text-zinc-400'
                          }`}
                        >
                          {r.isCustom ? 'Custom' : 'Default'}
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
                              {saving === r.wilayaId ? '…' : 'Save'}
                            </button>
                          )}
                          {r.isCustom && !dirty && (
                            <button
                              onClick={() => resetRow(r)}
                              disabled={saving === r.wilayaId}
                              className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-zinc-700 disabled:opacity-50"
                            >
                              Reset
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
