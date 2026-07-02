'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { analyzePagePosts, importExtractedProducts, type ExtractedProduct } from '@/lib/page-config-api';
import { useToast } from '@/components/ui/Toast';
import { SearchIcon, AlertIcon, ImageIcon, CheckCircleIcon, SparklesIcon } from '@/components/ui/icons';
import { useTranslation } from '@/contexts/LanguageContext';

interface DraftItem extends ExtractedProduct {
  selected: boolean;
  quantity: number;
}

const isItemValid = (i: DraftItem) =>
  i.name.trim().length > 0 && i.priceDA > 0 && i.quantity > 0;

const itemErrors = (i: DraftItem): string[] => {
  const errs: string[] = [];
  if (!i.name.trim()) errs.push('name');
  if (!i.priceDA || i.priceDA <= 0) errs.push('price');
  if (!i.quantity || i.quantity <= 0) errs.push('stock');
  return errs;
};

export default function AnalyzePage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();
  const pageId = params?.pageId as string;

  const [phase, setPhase] = useState<'idle' | 'scanning' | 'review' | 'importing' | 'done'>('idle');
  const [pageName, setPageName] = useState('');
  const [scanned, setScanned] = useState(0);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);

  const [needsReconnect, setNeedsReconnect] = useState(false);

  const startScan = async () => {
    setPhase('scanning');
    setWarning(null);
    setNeedsReconnect(false);
    try {
      const res = await analyzePagePosts(pageId, 30);
      setPageName(res.pageName);
      setScanned(res.scanned);
      setWarning(res.warning);
      setItems(res.extracted.map((e) => ({ ...e, selected: true, quantity: 1 })));
      setPhase('review');
    } catch (err: any) {
      const data = err?.data || err?.response?.data;
      if (data?.needsReconnect || /reconnect/i.test(err?.message || '')) {
        setNeedsReconnect(true);
      }
      toast.error(err?.message || t('analyze.toast.cantAnalyze'));
      setPhase('idle');
    }
  };

  const toggleItem = (idx: number) => {
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)));
  };
  const editItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const importToStock = async () => {
    const chosen = items.filter((i) => i.selected);
    if (chosen.length === 0) {
      toast.error(t('analyze.toast.selectAtLeastOne'));
      return;
    }
    const invalid = chosen.filter((c) => !isItemValid(c));
    if (invalid.length > 0) {
      toast.error(
        t('analyze.toast.invalidGate')
          .replace('{n}', String(invalid.length))
          .replace(/\{plural\}/g, invalid.length > 1 ? 's' : ''),
      );
      return;
    }
    setPhase('importing');
    try {
      const result = await importExtractedProducts(
        pageId,
        chosen.map((c) => ({
          name: c.name.trim(),
          description: c.description,
          priceDA: c.priceDA,
          quantity: c.quantity,
          imageUrl: c.imageUrl,
          sourcePostId: c.postId,
        })),
      );
      setImportResult(result);
      setPhase('done');
    } catch (err: any) {
      toast.error(err?.message || t('analyze.toast.cantImport'));
      setPhase('review');
    }
  };

  const selectedItems = items.filter((i) => i.selected);
  const selectedCount = selectedItems.length;
  const invalidCount = selectedItems.filter((i) => !isItemValid(i)).length;
  const canImport = selectedCount > 0 && invalidCount === 0;

  return (
    <div className="space-y-6">
      <header>
        <button
          onClick={() => router.push(`/dashboard/page/${pageId}`)}
          className="text-xs text-zinc-500 hover:text-white mb-3"
        >
          {t('analyze.back')}
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
          {t('analyze.title')}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">{t('analyze.subtitle')}</p>
      </header>

      {phase === 'idle' && (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-zinc-300 mx-auto mb-4 flex items-center justify-center">
            <SearchIcon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">{t('analyze.idle.title')}</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">{t('analyze.idle.desc')}</p>
          {needsReconnect && (
            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 max-w-md mx-auto mb-4 text-start">
              <p className="text-sm font-semibold text-white mb-1">{t('analyze.reconnect.title')}</p>
              <p className="text-xs text-zinc-500 mb-2">{t('analyze.reconnect.desc')}</p>
              <button
                onClick={() => router.push('/dashboard?section=pages')}
                className="px-3 py-1.5 bg-white hover:bg-zinc-100 text-black rounded-lg text-xs font-semibold transition-colors"
              >
                {t('analyze.reconnect.cta')}
              </button>
            </div>
          )}
          <button
            onClick={startScan}
            className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-100 transition-colors"
          >
            {t('analyze.start')}
          </button>
        </div>
      )}

      {phase === 'scanning' && (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center">
          <div className="inline-flex items-center gap-3 text-zinc-400">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-sm">{t('analyze.scanning')}</span>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3">
            <div className="text-sm">
              <span className="text-white font-semibold">{pageName}</span>
              <span className="text-zinc-500"> · {t('analyze.review.scanned').replace('{n}', String(scanned))} · </span>
              <span className="text-zinc-300">{t('analyze.review.detected').replace('{n}', String(items.length))}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setItems(items.map((i) => ({ ...i, selected: true })))}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1"
              >
                {t('analyze.btn.selectAll')}
              </button>
              <button
                onClick={() => setItems(items.map((i) => ({ ...i, selected: false })))}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1"
              >
                {t('analyze.btn.deselectAll')}
              </button>
              <button
                onClick={importToStock}
                disabled={!canImport}
                title={!canImport && invalidCount > 0 ? t('analyze.btn.importHint').replace('{n}', String(invalidCount)).replace(/\{plural\}/g, invalidCount > 1 ? 's' : '') : undefined}
                className="px-4 py-2 bg-white hover:bg-zinc-100 text-black rounded-lg text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {t('analyze.btn.import').replace('{n}', String(selectedCount))}
              </button>
            </div>
          </div>

          {warning && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-sm text-white font-medium">
              {warning}
            </div>
          )}

          {invalidCount > 0 && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-sm text-white font-medium flex items-center gap-2">
              <AlertIcon className="w-4 h-4 flex-shrink-0 text-zinc-500" />
              <span>
                {t('analyze.invalid.message')
                  .replace('{n}', String(invalidCount))
                  .replace(/\{plural\}/g, invalidCount > 1 ? 's' : '')}
              </span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center text-sm text-zinc-500">
              {t('analyze.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((item, idx) => {
                const errs = itemErrors(item);
                const showErrors = item.selected && errs.length > 0;
                return (
                  <div
                    key={item.postId + idx}
                    className={`bg-zinc-900/50 border rounded-xl overflow-hidden transition-all ${
                      !item.selected
                        ? 'border-white/10 opacity-60'
                        : showErrors
                        ? 'border-white/20 ring-1 ring-white/10'
                        : 'border-white/30 ring-1 ring-white/10'
                    }`}
                  >
                    <div
                      onClick={() => toggleItem(idx)}
                      role="button"
                      tabIndex={0}
                      aria-label={item.selected ? 'Deselect' : 'Select'}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(idx); } }}
                      className="relative aspect-[4/3] bg-black cursor-pointer group"
                    >
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex flex-col items-center justify-center gap-1 text-zinc-600">
                          <ImageIcon className="w-9 h-9" />
                          <span className="text-[10px] uppercase tracking-wider">No image</span>
                        </div>
                      )}
                      {/* Translucent dim on hover so the user knows the card is clickable */}
                      <div className={`absolute inset-0 transition-colors ${item.selected ? 'bg-black/0' : 'bg-black/0 group-hover:bg-black/20'}`} />
                      {/* Select check — always rendered, regardless of image */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleItem(idx); }}
                        aria-label={item.selected ? 'Deselect' : 'Select'}
                        className={`absolute top-2 end-2 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                          item.selected
                            ? 'bg-white border-white text-black shadow-lg shadow-black/30'
                            : 'bg-black/70 border-white/30 text-transparent group-hover:text-white/40 group-hover:border-white/60'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </div>
                    <div className="p-3 space-y-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => editItem(idx, { name: e.target.value })}
                        placeholder={t('analyze.field.namePh')}
                        className={`w-full bg-transparent border-b text-sm font-semibold text-white px-1 py-1 focus:outline-none ${
                          showErrors && errs.includes('name')
                            ? 'border-white/40 focus:border-white/60'
                            : 'border-white/10 focus:border-white/30'
                        }`}
                      />
                      <textarea
                        value={item.description}
                        onChange={(e) => editItem(idx, { description: e.target.value })}
                        rows={2}
                        className="w-full bg-black/30 border border-white/10 focus:border-white/30 rounded-md text-xs text-zinc-300 px-2 py-1.5 focus:outline-none resize-none"
                        placeholder={t('analyze.field.descPh')}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                            {t('analyze.field.price')}
                            <span className="text-zinc-500">*</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={item.priceDA || ''}
                            onChange={(e) => editItem(idx, { priceDA: parseInt(e.target.value, 10) || 0 })}
                            placeholder="0"
                            className={`w-full mt-1 bg-black/30 border rounded-md text-xs text-white px-2 py-1.5 focus:outline-none ${
                              showErrors && errs.includes('price')
                                ? 'border-white/40 focus:border-white/60'
                                : 'border-white/10 focus:border-white/30'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                            {t('analyze.field.stock')}
                            <span className="text-zinc-500">*</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={item.quantity || ''}
                            onChange={(e) => editItem(idx, { quantity: parseInt(e.target.value, 10) || 0 })}
                            placeholder="0"
                            className={`w-full mt-1 bg-black/30 border rounded-md text-xs text-white px-2 py-1.5 focus:outline-none ${
                              showErrors && errs.includes('stock')
                                ? 'border-white/40 focus:border-white/60'
                                : 'border-white/10 focus:border-white/30'
                            }`}
                          />
                        </div>
                      </div>
                      {showErrors && (
                        <p className="text-[11px] text-zinc-300 flex items-center gap-1">
                          <AlertIcon className="w-3 h-3 flex-shrink-0 text-zinc-500" />
                          <span>{t('analyze.field.errorHint').replace('{fields}', errs.join(', '))}</span>
                        </p>
                      )}
                      {item.category && (
                        <span className="inline-block text-[10px] uppercase tracking-wider text-zinc-500">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {phase === 'importing' && (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center">
          <div className="inline-flex items-center gap-3 text-zinc-400">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-sm">{t('analyze.importing')}</span>
          </div>
        </div>
      )}

      {phase === 'done' && importResult && (
        <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 text-zinc-300 mx-auto mb-3 flex items-center justify-center">
            <CheckCircleIcon className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">{t('analyze.done.title').replace('{n}', String(importResult.created))}</h3>
          {importResult.skipped > 0 && (
            <p className="text-xs text-zinc-500 mb-4">{t('analyze.done.skipped').replace('{n}', String(importResult.skipped))}</p>
          )}
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => router.push('/dashboard/stock/products')}
              className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-100"
            >
              {t('analyze.done.openStock')}
            </button>
            <button
              onClick={() => router.push(`/dashboard/page/${pageId}`)}
              className="px-4 py-2 text-sm text-zinc-300 hover:text-white"
            >
              {t('analyze.done.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
