'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui';
import { ChevronLeftIcon, DollarIcon } from '@/components/ui/icons';
import { getSale, updateSalePayment, type Sale } from '@/lib/user-stock-api';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/contexts/LanguageContext';

// Minimal edit page that handles the fields the backend actually supports
// (paymentStatus, paymentMethod, notes). Sale items + prices are immutable
// once recorded — editing them would require unwinding stock movements, and
// the bug report only asks for the route to exist (was 404 — see
// EditSalesPageNotFound.png).
export default function EditSalePage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { t } = useTranslation();
  const saleId = String(params?.saleId || '');

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'partial'>('pending');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!saleId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getSale(saleId);
        if (cancelled) return;
        setSale(res.sale);
        setPaymentStatus(res.sale.paymentStatus);
        setPaymentMethod(res.sale.paymentMethod || 'cash');
        setNotes(res.sale.notes || '');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load sale');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [saleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;
    try {
      setSaving(true);
      await updateSalePayment(saleId, {
        paymentStatus,
        paymentMethod,
        notes: notes || undefined,
      });
      toast.success('Sale updated');
      router.push('/dashboard/stock/sales');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update sale');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-zinc-800 rounded" />
        <div className="h-64 bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/dashboard/stock/sales')}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Sales
        </button>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
          {error || 'Sale not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <button
          onClick={() => router.push('/dashboard/stock/sales')}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors mb-4"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Sales
        </button>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
          Edit Sale {sale.saleNumber}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Update payment + notes. Items and prices cannot be changed once a sale is recorded.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Read-only summary */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Customer</span>
            <span className="text-white">{sale.customerName || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Items</span>
            <span className="text-white">{sale.items.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">{t('stock.common.total')}</span>
            <span className="text-white font-semibold">
              {Number(sale.total).toLocaleString()} DA
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Date</span>
            <span className="text-white">{new Date(sale.saleDate).toLocaleString()}</span>
          </div>
        </div>

        {/* Payment status */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Payment status
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['paid', 'pending', 'partial'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPaymentStatus(s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  paymentStatus === s
                    ? 'bg-white text-black border border-transparent'
                    : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                }`}
              >
                {s === 'paid' ? 'Paid' : s === 'pending' ? 'Pending' : 'Partial'}
              </button>
            ))}
          </div>
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Payment method
          </label>
          <div className="relative">
            <DollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Bank transfer</option>
              <option value="ccp">CCP</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes"
            className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => router.push('/dashboard/stock/sales')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
