'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Select, DatePicker } from '@/components/stock';
import { Button } from '@/components/ui';
import {
  ChevronLeftIcon, TrashIcon, PlusIcon, SearchIcon, UserIcon,
  PhoneIcon, DollarIcon,
} from '@/components/ui/icons';
import { getProducts, getClients, createSale, type Product, type ProductVariant, type Client } from '@/lib/user-stock-api';

// ── Keyboard-navigable Client Autocomplete ──
function ClientAutocomplete({
  clients,
  onSelect,
  selectedClient,
}: {
  clients: Client[];
  onSelect: (client: Client | null) => void;
  selectedClient: Client | null;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return clients.slice(0, 50);
    const q = query.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)
    );
  }, [clients, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setHighlightIdx(-1); }, [filtered]);

  // Scroll highlighted item into view
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
          value={selectedClient ? selectedClient.name : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (selectedClient) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search client by name or phone..."
          className={`w-full pl-10 pr-4 py-2.5 bg-black border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-white/20 ${
            selectedClient ? 'border-white/30 text-white' : 'border-white/10 text-white placeholder-zinc-500'
          }`}
        />
        {selectedClient && (
          <button
            type="button"
            onClick={() => { onSelect(null); setQuery(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            ×
          </button>
        )}
      </div>
      {open && !selectedClient && (
        <div ref={listRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-500">No clients found</div>
          ) : (
            filtered.map((c, idx) => (
              <div
                key={c.id}
                className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                  idx === highlightIdx ? 'bg-white/10 text-white' : 'text-zinc-300 hover:bg-white/5'
                }`}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => {
                  onSelect(c);
                  setQuery(c.name);
                  setOpen(false);
                }}
              >
                <div className="w-8 h-8 rounded-full bg-white/5 text-zinc-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  {c.phone && <div className="text-xs text-zinc-500">{c.phone}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Keyboard-navigable Product Autocomplete (with per-variant picker rows) ──
function ProductAutocomplete({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (product: Product, variant?: ProductVariant) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => { setHighlightIdx(-1); setExpandedId(null); }, [filtered]);

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const justClosedRef = useRef(false);
  const selectProduct = (p: Product, variant?: ProductVariant) => {
    onAdd(p, variant);
    setQuery('');
    setOpen(false);
    setHighlightIdx(-1);
    setExpandedId(null);
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
        const p = filtered[highlightIdx];
        if (p.hasVariants) {
          // Variants must be picked explicitly — Enter toggles the variant rows
          setExpandedId((id) => (id === p.id ? null : p.id));
        } else if (p.quantity > 0) {
          selectProduct(p);
        }
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
            filtered.map((p, idx) => {
              const activeVariants = p.hasVariants ? (p.variants || []).filter((v) => v.isActive) : [];
              const inStock = p.hasVariants
                ? activeVariants.some((v) => v.quantity > 0)
                : p.quantity > 0;
              const expanded = expandedId === p.id;
              return (
                <div key={p.id}>
                  <div
                    className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      idx === highlightIdx ? 'bg-white/10' : 'hover:bg-white/5'
                    } ${!inStock ? 'opacity-40 cursor-not-allowed' : ''}`}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => {
                      if (p.hasVariants) setExpandedId(expanded ? null : p.id);
                      else if (inStock) selectProduct(p);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">{p.name}</div>
                      <div className="text-xs text-zinc-500">{p.sku}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {!p.hasVariants ? (
                        <>
                          <div className="text-sm text-zinc-300 font-medium">{Number(p.sellingPrice).toLocaleString()} DA</div>
                          <div className={`text-xs ${p.quantity > 0 ? 'text-zinc-500' : 'text-zinc-600'}`}>
                            {p.quantity > 0 ? `${p.quantity} in stock` : 'Out of stock'}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-zinc-500">
                          {activeVariants.length} variant{activeVariants.length !== 1 ? 's' : ''} {expanded ? '▴' : '▾'}
                        </div>
                      )}
                    </div>
                  </div>
                  {p.hasVariants && expanded && (
                    <div className="bg-black/40 border-t border-white/5">
                      {activeVariants.length === 0 ? (
                        <div className="pl-10 pr-4 py-2 text-xs text-zinc-600">No active variants</div>
                      ) : (
                        activeVariants.map((v) => {
                          const vInStock = v.quantity > 0;
                          return (
                            <div
                              key={v.id}
                              className={`pl-10 pr-4 py-2 flex items-center justify-between gap-3 transition-colors ${
                                vInStock ? 'cursor-pointer hover:bg-white/5' : 'opacity-40 cursor-not-allowed'
                              }`}
                              onClick={(e) => { e.stopPropagation(); if (vInStock) selectProduct(p, v); }}
                            >
                              <div className="text-sm text-zinc-200 truncate">{v.name}</div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm text-zinc-300 font-medium">{Number(v.sellingPrice).toLocaleString()} DA</div>
                                <div className={`text-xs ${vInStock ? 'text-zinc-500' : 'text-zinc-600'}`}>
                                  {vInStock ? `${v.quantity} in stock` : 'Out of stock'}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function NewSalePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

  const [saleItems, setSaleItems] = useState<{
    productId: string; productName: string; variantId?: string; variantName?: string;
    quantity: number; unitPrice: number;
  }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [prodRes, clientRes] = await Promise.all([
          getProducts({ limit: 500 }),
          getClients(),
        ]);
        setProducts(prodRes.products);
        setClients(clientRes.clients);
      } catch {}
    };
    load();
  }, []);

  const availableProducts = useMemo(() => {
    return products.filter(
      (p) => p.isActive && (p.quantity > 0 || (p.hasVariants && p.variants?.some(v => v.quantity > 0 && v.isActive)))
    );
  }, [products]);

  const addProduct = useCallback((product: Product, variant?: ProductVariant) => {
    const price = variant ? Number(variant.sellingPrice) : Number(product.sellingPrice);
    // Dedupe lines by productId + variantId (a product can appear once per variant)
    const existing = saleItems.findIndex(
      (i) => i.productId === product.id && (variant ? i.variantId === variant.id : !i.variantId)
    );
    if (existing >= 0) {
      const updated = [...saleItems];
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
      setSaleItems(updated);
    } else {
      setSaleItems((prev) => [...prev, {
        productId: product.id,
        productName: product.name,
        variantId: variant?.id,
        variantName: variant?.name,
        quantity: 1,
        unitPrice: price,
      }]);
    }
  }, [saleItems]);

  const updateItemQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    const updated = [...saleItems];
    updated[idx] = { ...updated[idx], quantity: qty };
    setSaleItems(updated);
  };

  const updateItemPrice = (idx: number, price: number) => {
    const updated = [...saleItems];
    updated[idx] = { ...updated[idx], unitPrice: price };
    setSaleItems(updated);
  };

  const removeItem = (idx: number) => {
    setSaleItems(saleItems.filter((_, i) => i !== idx));
  };

  const saleTotal = saleItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const paid = amountPaid === '' ? saleTotal : parseFloat(amountPaid) || 0;
  const remaining = Math.max(0, saleTotal - paid);
  const paymentStatus = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';

  const customerName = selectedClient?.name || manualName;
  const customerPhone = selectedClient?.phone || manualPhone;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saleItems.length === 0) { setError('Add at least one product'); return; }
    try {
      setError(null);
      setSaving(true);
      await createSale({
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        items: saleItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          variantId: i.variantId,
          variantName: i.variantName,
        })),
        amountPaid: paid,
        paymentMethod,
        paymentStatus,
        saleDate: saleDate || undefined,
        notes: notes || undefined,
      });
      router.push('/dashboard/stock/sales');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sale');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/dashboard/stock/sales')}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Sales
        </button>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>New Sale</h1>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left Column: Client + Products ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Client & Date row */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-zinc-400" /> Client
                </h2>
                <DatePicker
                  value={saleDate}
                  onChange={setSaleDate}
                />
              </div>

              {/* Client search */}
              <ClientAutocomplete
                clients={clients}
                selectedClient={selectedClient}
                onSelect={setSelectedClient}
              />

              {/* Manual entry fallback */}
              {!selectedClient && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Or type client name"
                      className="w-full pl-10 pr-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div className="relative">
                    <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="Phone"
                      className="w-full pl-10 pr-3 py-2 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Products */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <PlusIcon className="w-4 h-4 text-zinc-400" /> Add Products
              </h2>

              <ProductAutocomplete
                products={availableProducts}
                onAdd={addProduct}
              />

              {/* Items table */}
              {saleItems.length > 0 ? (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-800/50">
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2.5">#</th>
                        <th className="text-left text-xs font-medium text-zinc-400 px-4 py-2.5">Product</th>
                        <th className="text-center text-xs font-medium text-zinc-400 px-4 py-2.5">Qty</th>
                        <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2.5">Price</th>
                        <th className="text-right text-xs font-medium text-zinc-400 px-4 py-2.5">Total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {saleItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-white/5 hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5 text-xs text-zinc-500">{idx + 1}</td>
                          <td className="px-4 py-2.5 text-sm text-white font-medium">
                            {item.productName}
                            {item.variantName && <span className="text-xs text-zinc-500 ml-1">({item.variantName})</span>}
                          </td>
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
                              value={item.unitPrice}
                              onChange={(e) => updateItemPrice(idx, parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 bg-black border border-white/10 rounded text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-white/20"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-sm text-right text-white font-medium">
                            {(item.quantity * item.unitPrice).toLocaleString()} DA
                          </td>
                          <td className="px-2 py-2.5">
                            <button type="button" onClick={() => removeItem(idx)} className="p-1 text-zinc-500 hover:text-white transition-colors">
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
                placeholder="Add a note for this sale..."
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
                <p className="text-3xl font-bold text-white">{saleTotal.toLocaleString()} <span className="text-lg text-zinc-400">DA</span></p>
                <p className="text-xs text-zinc-500 mt-1">{saleItems.length} item{saleItems.length !== 1 ? 's' : ''}</p>
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
                    placeholder={saleTotal.toLocaleString()}
                    className="w-full pl-10 pr-12 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">DA</span>
                </div>
              </div>

              {/* Remaining / Debt */}
              {remaining > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-zinc-500 mb-0.5">Remaining (Debt)</p>
                  <p className="text-xl font-bold text-white">{remaining.toLocaleString()} DA</p>
                </div>
              )}
              {remaining <= 0 && saleTotal > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-zinc-500 mb-0.5">Fully Paid</p>
                  <p className="text-xl font-bold text-white">0 DA</p>
                </div>
              )}

              {/* Status indicator */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Status</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-[11px] text-zinc-300">
                  {paymentStatus === 'paid' ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full border border-zinc-600" />
                  )}
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
                <Button type="submit" className="w-full" disabled={saving || saleItems.length === 0}>
                  {saving ? 'Creating...' : 'Complete Sale'}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => router.push('/dashboard/stock/sales')}>
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
