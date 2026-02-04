'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import {
  ChevronLeftIcon, TrashIcon, PlusIcon, SearchIcon, TruckIcon,
  CalendarIcon, DollarIcon,
} from '@/components/ui/icons';
import { getProducts, getSuppliers, createPurchase, type Product, type Supplier } from '@/lib/user-stock-api';

// ── Keyboard-navigable Supplier Autocomplete ──
function SupplierAutocomplete({
  suppliers,
  onSelect,
  selectedSupplier,
}: {
  suppliers: Supplier[];
  onSelect: (supplier: Supplier | null) => void;
  selectedSupplier: Supplier | null;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return suppliers.slice(0, 50);
    const q = query.toLowerCase();
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone || '').includes(q)
    );
  }, [suppliers, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setHighlightIdx(-1); }, [filtered]);

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault(); } return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && filtered[highlightIdx]) {
        onSelect(filtered[highlightIdx]);
        setQuery(filtered[highlightIdx].name);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={selectedSupplier ? selectedSupplier.name : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (selectedSupplier) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search supplier by name or phone..."
          className={`w-full pl-10 pr-4 py-2.5 bg-black border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-white/20 ${
            selectedSupplier ? 'border-violet-500/40 text-violet-400' : 'border-white/10 text-white placeholder-zinc-500'
          }`}
        />
        {selectedSupplier && (
          <button
            type="button"
            onClick={() => { onSelect(null); setQuery(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            ×
          </button>
        )}
      </div>
      {open && !selectedSupplier && (
        <div ref={listRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-500">No suppliers found</div>
          ) : (
            filtered.map((s, idx) => (
              <div
                key={s.id}
                className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                  idx === highlightIdx ? 'bg-white/10 text-white' : 'text-zinc-300 hover:bg-white/5'
                }`}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => {
                  onSelect(s);
                  setQuery(s.name);
                  setOpen(false);
                }}
              >
                <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  {s.phone && <div className="text-xs text-zinc-500">{s.phone}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Keyboard-navigable Product Autocomplete ──
function ProductAutocomplete({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (product: Product) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const justClosedRef = useRef(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, 50);
    const q = query.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setHighlightIdx(-1); }, [filtered]);

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const selectProduct = (p: Product) => {
    onAdd(p);
    setQuery('');
    setOpen(false);
    setHighlightIdx(-1);
    justClosedRef.current = true;
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === 'ArrowDown' || (e.key === 'Enter' && query)) { setOpen(true); e.preventDefault(); } return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && filtered[highlightIdx]) {
        selectProduct(filtered[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (justClosedRef.current) { justClosedRef.current = false; return; } if (query || products.length) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search product by name or SKU... (↑↓ to navigate, Enter to add)"
          className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
      </div>
      {open && (
        <div ref={listRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-500">No products found</div>
          ) : (
            filtered.map((p, idx) => (
              <div
                key={p.id}
                className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  idx === highlightIdx ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => selectProduct(p)}
              >
                <div className="min-w-0">
                  <div className="text-sm text-white font-medium truncate">{p.name}</div>
                  <div className="text-xs text-zinc-500">{p.sku}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm text-zinc-400 font-medium">{Number(p.costPrice).toLocaleString()} DA</div>
                  <div className="text-xs text-zinc-500">{p.quantity} in stock</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function NewPurchasePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

  const [purchaseItems, setPurchaseItems] = useState<{
    productId: string; productName: string; quantity: number; unitCost: number;
  }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [prodRes, suppRes] = await Promise.all([
          getProducts({ limit: 500 }),
          getSuppliers(),
        ]);
        setProducts(prodRes.products);
        setSuppliers(suppRes.suppliers);
      } catch {}
    };
    load();
  }, []);

  const addProduct = useCallback((product: Product) => {
    const cost = Number(product.costPrice);
    const existing = purchaseItems.findIndex((i) => i.productId === product.id);
    if (existing >= 0) {
      const updated = [...purchaseItems];
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
      setPurchaseItems(updated);
    } else {
      setPurchaseItems((prev) => [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: cost,
      }]);
    }
  }, [purchaseItems]);

  const updateItemQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    const updated = [...purchaseItems];
    updated[idx] = { ...updated[idx], quantity: qty };
    setPurchaseItems(updated);
  };

  const updateItemCost = (idx: number, cost: number) => {
    const updated = [...purchaseItems];
    updated[idx] = { ...updated[idx], unitCost: cost };
    setPurchaseItems(updated);
  };

  const removeItem = (idx: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== idx));
  };

  const purchaseTotal = purchaseItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const paid = amountPaid === '' ? purchaseTotal : parseFloat(amountPaid) || 0;
  const remaining = Math.max(0, purchaseTotal - paid);
  const paymentStatus = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0) { setError('Add at least one product'); return; }
    try {
      setError(null);
      setSaving(true);
      await createPurchase({
        supplierId: selectedSupplier?.id || undefined,
        items: purchaseItems.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
        paymentStatus: paymentStatus === 'partial' ? 'pending' : paymentStatus,
        notes: notes || undefined,
      });
      router.push('/dashboard/stock/purchases');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/dashboard/stock/purchases')}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Purchases
        </button>
        <h1 className="text-2xl font-bold text-white">New Purchase Order</h1>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left Column: Supplier + Products ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Supplier & Date row */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TruckIcon className="w-4 h-4 text-zinc-400" /> Supplier
                </h2>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-zinc-500" />
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="bg-black border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
              </div>

              <SupplierAutocomplete
                suppliers={suppliers}
                selectedSupplier={selectedSupplier}
                onSelect={setSelectedSupplier}
              />
            </div>

            {/* Products */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <PlusIcon className="w-4 h-4 text-zinc-400" /> Add Products
              </h2>

              <ProductAutocomplete
                products={products}
                onAdd={addProduct}
              />

              {/* Items table */}
              {purchaseItems.length > 0 ? (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-800/50">
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2.5">#</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2.5">Product</th>
                        <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2.5">Qty</th>
                        <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2.5">Unit Cost</th>
                        <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2.5">Total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-white/5 hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5 text-xs text-zinc-500">{idx + 1}</td>
                          <td className="px-4 py-2.5 text-sm text-white font-medium">{item.productName}</td>
                          <td className="px-4 py-2.5 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItemQty(idx, parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1 bg-black border border-white/10 rounded text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) => updateItemCost(idx, parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 bg-black border border-white/10 rounded text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-sm text-right text-white font-medium">
                            {(item.quantity * item.unitCost).toLocaleString()} DA
                          </td>
                          <td className="px-2 py-2.5">
                            <button type="button" onClick={() => removeItem(idx)} className="p-1 text-zinc-500 hover:text-red-400 transition-colors">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-dashed border-white/10 rounded-lg py-8 text-center">
                  <p className="text-sm text-zinc-500">Search and select products above to add them</p>
                  <p className="text-xs text-zinc-600 mt-1">Use ↑↓ arrows to navigate, Enter to add</p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
              <label className="block text-xs text-zinc-400 mb-2">Remarque / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note for this purchase..."
                rows={2}
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
              />
            </div>
          </div>

          {/* ── Right Column: Payment Summary ── */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 space-y-5 lg:sticky lg:top-24">
              <h2 className="text-sm font-semibold text-white">Payment Summary</h2>

              {/* Total */}
              <div className="bg-black/50 rounded-lg p-4 text-center">
                <p className="text-xs text-zinc-500 mb-1">Total</p>
                <p className="text-3xl font-bold text-white">{purchaseTotal.toLocaleString()} <span className="text-lg text-zinc-400">DA</span></p>
                <p className="text-xs text-zinc-500 mt-1">{purchaseItems.length} item{purchaseItems.length !== 1 ? 's' : ''}</p>
              </div>

              {/* Amount Paid */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Amount Paid</label>
                <div className="relative">
                  <DollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={purchaseTotal.toLocaleString()}
                    className="w-full pl-10 pr-12 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">DA</span>
                </div>
              </div>

              {/* Remaining / Debt */}
              {remaining > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-400 mb-0.5">Remaining (Debt)</p>
                  <p className="text-xl font-bold text-red-400">{remaining.toLocaleString()} DA</p>
                </div>
              )}
              {remaining <= 0 && purchaseTotal > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-emerald-400 mb-0.5">Fully Paid</p>
                  <p className="text-xl font-bold text-emerald-400">0 DA</p>
                </div>
              )}

              {/* Status indicator */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  paymentStatus === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : paymentStatus === 'partial'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-red-500/20 text-red-400'
                }`}>
                  {paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partial' ? 'Partial' : 'Pending'}
                </span>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="ccp">CCP</option>
                </select>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <Button type="submit" className="w-full" disabled={saving || purchaseItems.length === 0}>
                  {saving ? 'Creating...' : 'Create Purchase'}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => router.push('/dashboard/stock/purchases')}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
