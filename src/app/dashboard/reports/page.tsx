'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { REPORT_CATALOG, type ReportMeta } from '@/lib/reports-api';
import { useTranslation } from '@/contexts/LanguageContext';

// Section order and human labels for the catalog. Monochrome, no color — the
// hub mirrors the dark ledger aesthetic of the individual report views.
const CATEGORY_ORDER: ReportMeta['category'][] = [
  'finance',
  'sales',
  'purchases',
  'inventory',
  'customers',
  'suppliers',
];

const CATEGORY_LABEL: Record<ReportMeta['category'], string> = {
  finance: 'Finance',
  sales: 'Sales',
  purchases: 'Purchases',
  inventory: 'Inventory',
  customers: 'Customers',
  suppliers: 'Suppliers',
};

function ArrowIcon() {
  // Forward arrow that flips in RTL so it always points "into" the report.
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      className="rtl:rotate-180"
    >
      <path
        d="M3 7 H10 M7 4 L10.5 7 L7 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 L14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ReadyCard({ report }: { report: ReportMeta }) {
  const { t } = useTranslation();
  return (
    <Link
      href={`/dashboard/reports/${report.key}`}
      className="group flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-zinc-900/50 p-5 transition-all hover:border-white/20 hover:bg-zinc-900/80"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3
            className="text-base font-bold text-white leading-snug"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            {t(`rep.cat.${report.key}.title`, report.title)}
          </h3>
          <span className="mt-0.5 shrink-0 text-zinc-600 transition-all group-hover:text-white group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
            <ArrowIcon />
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          {t(`rep.cat.${report.key}.desc`, report.description)}
        </p>
      </div>
    </Link>
  );
}

function SoonCard({ report }: { report: ReportMeta }) {
  const { t } = useTranslation();
  const soonReason = report.soonReason
    ? t(`rep.cat.${report.key}.soon`, report.soonReason)
    : undefined;
  return (
    <div
      title={soonReason}
      className="flex cursor-default flex-col justify-between gap-4 rounded-xl border border-white/10 bg-zinc-900/30 p-5 opacity-60"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3
            className="text-base font-bold text-zinc-400 leading-snug"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            {t(`rep.cat.${report.key}.title`, report.title)}
          </h3>
          <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500 whitespace-nowrap">
            {t('rep.hub.requiresSetup')}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
          {t(`rep.cat.${report.key}.desc`, report.description)}
        </p>
        {report.soonReason && (
          <p className="mt-2 text-[11px] text-zinc-600">{soonReason}</p>
        )}
      </div>
    </div>
  );
}

export default function ReportsHubPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const readyCount = useMemo(
    () => REPORT_CATALOG.filter((r) => r.status === 'ready').length,
    [],
  );

  const groups = useMemo(() => {
    const nq = query.trim().toLowerCase();
    const match = (r: ReportMeta) =>
      !nq ||
      r.title.toLowerCase().includes(nq) ||
      r.description.toLowerCase().includes(nq) ||
      CATEGORY_LABEL[r.category].toLowerCase().includes(nq) ||
      r.key.toLowerCase().includes(nq);

    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: REPORT_CATALOG.filter((r) => r.category === cat && match(r)).sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'ready' ? -1 : 1,
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const hasResults = groups.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-2">
            {t('rep.hub.eyebrow')}
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold text-white"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            {t('rep.hub.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            {t('rep.hub.subtitle').replace('{count}', String(readyCount))}
          </p>
        </div>

        {/* Search / filter */}
        <div className="relative w-full sm:w-72">
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-zinc-500">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('rep.hub.search')}
            aria-label={t('rep.hub.searchAria')}
            className="w-full rounded-xl border border-white/10 bg-zinc-900/50 py-2.5 ps-9 pe-3 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-white/20"
          />
        </div>
      </div>

      {/* Catalog */}
      {hasResults ? (
        <div className="space-y-10">
          {groups.map(({ cat, items }) => (
            <section key={cat}>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                  {t(`rep.hub.cat.${cat}`, CATEGORY_LABEL[cat])}
                </h2>
                <span className="text-[10px] tabular-nums text-zinc-600">{items.length}</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((report) =>
                  report.status === 'ready' ? (
                    <ReadyCard key={report.key} report={report} />
                  ) : (
                    <SoonCard key={report.key} report={report} />
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 py-16 text-center">
          <p className="text-sm font-bold text-white">
            {t('rep.hub.noMatches').replace('{query}', query)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{t('rep.hub.noMatchesHint')}</p>
          <button
            onClick={() => setQuery('')}
            className="mt-4 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            {t('rep.hub.clearSearch')}
          </button>
        </div>
      )}
    </div>
  );
}
