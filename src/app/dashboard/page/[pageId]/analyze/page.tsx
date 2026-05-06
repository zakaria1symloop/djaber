'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { analyzePagePosts, importExtractedProducts, type ExtractedProduct } from '@/lib/page-config-api';
import { useToast } from '@/components/ui/Toast';

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
      toast.error(err?.message || 'Could not analyze posts');
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
      toast.error('Select at least one product');
      return;
    }
    const invalid = chosen.filter((c) => !isItemValid(c));
    if (invalid.length > 0) {
      toast.error(`Set name, price and stock on ${invalid.length} product${invalid.length > 1 ? 's' : ''} before importing`);
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
      toast.error(err?.message || 'Could not import to stock');
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
          ← Back to page
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
          AI page analysis
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          We&apos;ll scan your recent Facebook posts, detect products, and let you confirm what to import into your stock.
        </p>
      </header>

      {phase === 'idle' && (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-4 flex items-center justify-center text-2xl">
            🔍
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Scan recent posts</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
            Pulls up to 30 of your latest posts, runs vision AI to detect products, and shows you a preview before anything is added to stock.
          </p>
          {needsReconnect && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 max-w-md mx-auto mb-4 text-start">
              <p className="text-sm font-semibold text-amber-300 mb-1">Facebook permission needed</p>
              <p className="text-xs text-amber-200/80 mb-2">
                Your page was connected before we asked Facebook for the &quot;read posts&quot; permission. Reconnect the page to grant it.
              </p>
              <button
                onClick={() => router.push('/dashboard?section=pages')}
                className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline"
              >
                Go to Pages → reconnect
              </button>
            </div>
          )}
          <button
            onClick={startScan}
            className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-100 transition-colors"
          >
            Start scan
          </button>
        </div>
      )}

      {phase === 'scanning' && (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center">
          <div className="inline-flex items-center gap-3 text-zinc-400">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-sm">Scanning posts and extracting products… This can take 30–60 seconds.</span>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3">
            <div className="text-sm">
              <span className="text-white font-semibold">{pageName}</span>
              <span className="text-zinc-500"> · scanned {scanned} posts · </span>
              <span className="text-emerald-400">{items.length} products detected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setItems(items.map((i) => ({ ...i, selected: true })))}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1"
              >
                Select all
              </button>
              <button
                onClick={() => setItems(items.map((i) => ({ ...i, selected: false })))}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1"
              >
                Deselect all
              </button>
              <button
                onClick={importToStock}
                disabled={!canImport}
                title={!canImport && invalidCount > 0 ? `Fill in price and stock on ${invalidCount} product${invalidCount > 1 ? 's' : ''}` : undefined}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Import {selectedCount} to stock
              </button>
            </div>
          </div>

          {warning && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-sm text-amber-300">
              {warning}
            </div>
          )}

          {invalidCount > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-sm text-rose-300 flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>
                {invalidCount} selected product{invalidCount > 1 ? 's are' : ' is'} missing required fields. Set <strong>price (DA)</strong> and <strong>initial stock</strong> on each before importing.
              </span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center text-sm text-zinc-500">
              No products detected in your recent posts. The AI looks for product photos with prices or clear product captions.
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
                        ? 'border-rose-500/40 ring-1 ring-rose-500/20'
                        : 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                    }`}
                  >
                    {item.imageUrl ? (
                      <div className="relative aspect-[4/3] bg-black">
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        <button
                          onClick={() => toggleItem(idx)}
                          className={`absolute top-2 end-2 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                            item.selected ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-black/60 border-white/30 text-transparent'
                          }`}
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-zinc-800 flex items-center justify-center text-3xl text-zinc-600">📷</div>
                    )}
                    <div className="p-3 space-y-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => editItem(idx, { name: e.target.value })}
                        placeholder="Product name (required)"
                        className={`w-full bg-transparent border-b text-sm font-semibold text-white px-1 py-1 focus:outline-none ${
                          showErrors && errs.includes('name')
                            ? 'border-rose-500/60 focus:border-rose-400'
                            : 'border-white/10 focus:border-white/30'
                        }`}
                      />
                      <textarea
                        value={item.description}
                        onChange={(e) => editItem(idx, { description: e.target.value })}
                        rows={2}
                        className="w-full bg-black/30 border border-white/10 focus:border-white/30 rounded-md text-xs text-zinc-300 px-2 py-1.5 focus:outline-none resize-none"
                        placeholder="Description (optional)"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                            Price (DA)
                            <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={item.priceDA || ''}
                            onChange={(e) => editItem(idx, { priceDA: parseInt(e.target.value, 10) || 0 })}
                            placeholder="0"
                            className={`w-full mt-1 bg-black/30 border rounded-md text-xs text-white px-2 py-1.5 focus:outline-none ${
                              showErrors && errs.includes('price')
                                ? 'border-rose-500/60 focus:border-rose-400'
                                : 'border-white/10 focus:border-white/30'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                            Stock
                            <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={item.quantity || ''}
                            onChange={(e) => editItem(idx, { quantity: parseInt(e.target.value, 10) || 0 })}
                            placeholder="0"
                            className={`w-full mt-1 bg-black/30 border rounded-md text-xs text-white px-2 py-1.5 focus:outline-none ${
                              showErrors && errs.includes('stock')
                                ? 'border-rose-500/60 focus:border-rose-400'
                                : 'border-white/10 focus:border-white/30'
                            }`}
                          />
                        </div>
                      </div>
                      {showErrors && (
                        <p className="text-[11px] text-rose-300 flex items-center gap-1">
                          <span>⚠️</span>
                          <span>Fill {errs.join(', ')} to import</span>
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
            <span className="text-sm">Importing products to stock…</span>
          </div>
        </div>
      )}

      {phase === 'done' && importResult && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 mx-auto mb-3 flex items-center justify-center text-2xl">
            ✓
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Imported {importResult.created} products</h3>
          {importResult.skipped > 0 && (
            <p className="text-xs text-zinc-500 mb-4">{importResult.skipped} skipped</p>
          )}
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => router.push('/dashboard/stock/products')}
              className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-100"
            >
              Open stock
            </button>
            <button
              onClick={() => router.push(`/dashboard/page/${pageId}`)}
              className="px-4 py-2 text-sm text-zinc-300 hover:text-white"
            >
              Back to page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
