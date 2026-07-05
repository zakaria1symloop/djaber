'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReportShell, StatTile, StatTileRow, fmtDA } from '@/components/charts';
import {
  getCashRegister,
  type CashRegisterReport,
  type ReportPeriodParam,
} from '@/lib/reports-api';
import { useTranslation } from '@/contexts/LanguageContext';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CashRegisterPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ReportPeriodParam>('month');
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [data, setData] = useState<CashRegisterReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'custom' && (!range.startDate || !range.endDate)) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getCashRegister(period, period === 'custom' ? range : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rep.com.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ReportShell
      title={t('rep.fin.cashRegister.title')}
      description={t('rep.fin.cashRegister.desc')}
      period={period}
      onPeriodChange={(p) => {
        setPeriod(p);
        setRange({});
      }}
      startDate={range.startDate}
      endDate={range.endDate}
      onRangeChange={(s, e) => {
        setPeriod('custom');
        setRange({ startDate: s, endDate: e });
      }}
      loading={loading}
      error={error}
      onRetry={load}
    >
      {data && (
        <>
          <StatTileRow>
            <StatTile label={t('rep.c.income')} value={fmtDA(data.income)} />
            <StatTile label={t('rep.c.expense')} value={fmtDA(data.expense)} />
            <StatTile label={t('rep.c.balance')} value={fmtDA(data.balance)} />
            <StatTile label={t('rep.fin.cr.transactions')} value={data.count} />
          </StatTileRow>

          <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.02]">
                  <tr className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    <th className="text-start font-medium px-4 py-3 whitespace-nowrap">{t('rep.c.date')}</th>
                    <th className="text-start font-medium px-4 py-3">{t('rep.c.type')}</th>
                    <th className="text-start font-medium px-4 py-3">{t('rep.c.category')}</th>
                    <th className="text-start font-medium px-4 py-3">{t('rep.c.reference')}</th>
                    <th className="text-end font-medium px-4 py-3 whitespace-nowrap">{t('rep.c.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center">
                        <p className="text-sm font-bold text-white">{t('rep.fin.cr.noTransactions')}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {t('rep.fin.cr.noTransactionsHint')}
                        </p>
                      </td>
                    </tr>
                  )}
                  {data.rows.map((r) => {
                    const income = r.type === 'income';
                    return (
                      <tr key={r.id} className="border-t border-white/[0.06]">
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap tabular-nums">
                          {fmtDate(r.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-zinc-300">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                income ? 'bg-white' : 'bg-zinc-600'
                              }`}
                            />
                            {income ? t('rep.c.income') : t('rep.c.expense')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <span className="truncate">{r.category}</span>
                            {r.isAutomatic && (
                              <span className="shrink-0 text-[9px] uppercase tracking-wider text-zinc-500 border border-white/10 rounded px-1 py-0.5">
                                {t('rep.fin.cr.auto')}
                              </span>
                            )}
                          </span>
                          {r.description && (
                            <span className="block text-[11px] text-zinc-500 truncate mt-0.5">
                              {r.description}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                          {r.reference ?? '—'}
                        </td>
                        <td
                          className={`px-4 py-3 text-end tabular-nums whitespace-nowrap ${
                            income ? 'text-white' : 'text-zinc-500'
                          }`}
                        >
                          {income ? '+' : '−'}
                          {r.amount.toLocaleString()} DA
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </ReportShell>
  );
}
