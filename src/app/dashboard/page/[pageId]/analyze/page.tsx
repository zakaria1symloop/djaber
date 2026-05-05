'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { analyzePagePosts, importExtractedProducts, type ExtractedProduct } from '@/lib/page-config-api';
import { useToast } from '@/components/ui/Toast';

interface DraftItem extends ExtractedProduct {
  selected: boolean;
}

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

  const startScan = async () => {
    setPhase('scanning');
    setWarning(null);
    try {
      const res = await analyzePagePosts(pageId, 30);
      setPageName(res.pageName);
      setScanned(res.scanned);
      setWarning(res.warning);
      setItems(res.extracted.map((e) => ({ ...e, selected: true })));
      setPhase('review');
    } catch (err: any) {
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
    setPhase('importing');
    try {
      const result = await importExtractedProducts(
        pageId,
        chosen.map((c) => ({
          name: c.name,
          description: c.description,
          priceDA: c.priceDA,
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

  const selectedCount = items.filter((i) => i.selected).length;

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
                disabled={selectedCount === 0}
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

          {items.length === 0 ? (
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center text-sm text-zinc-500">
              No products detected in your recent posts. The AI looks for product photos with prices or clear product captions.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((item, idx) => (
                <div
                  key={item.postId + idx}
                  className={`bg-zinc-900/50 border rounded-xl overflow-hidden transition-all ${
                    item.selected ? 'border-emerald-500/40 ring-1 ring-emerald-500/20' : 'border-white/10 opacity-60'
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
                      className="w-full bg-transparent border-b border-white/10 focus:border-white/30 text-sm font-semibold text-white px-1 py-1 focus:outline-none"
                    />
                    <textarea
                      value={item.description}
                      onChange={(e) => editItem(idx, { description: e.target.value })}
                      rows={2}
                      className="w-full bg-black/30 border border-white/10 focus:border-white/30 rounded-md text-xs text-zinc-300 px-2 py-1.5 focus:outline-none resize-none"
                      placeholder="Description"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">Price (DA)</label>
                      <input
                        type="number"
                        value={item.priceDA || ''}
                        onChange={(e) => editItem(idx, { priceDA: parseInt(e.target.value, 10) || 0 })}
                        className="flex-1 bg-black/30 border border-white/10 focus:border-white/30 rounded-md text-xs text-white px-2 py-1 focus:outline-none"
                      />
                    </div>
                    {item.category && (
                      <span className="inline-block text-[10px] uppercase tracking-wider text-zinc-500">
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
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
