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
        if (!cancelled) setError(err instanceof Error ? err.message : t('stk.tr.sale.err.loadOne'));
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
      toast.success(t('stk.tr.sale.edit.toast'));
      router.push('/dashboard/stock/sales');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('stk.tr.sale.edit.err'));
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
          {t('stk.tr.sale.new.back')}
        </button>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
          {error || t('stk.tr.sale.edit.notFound')}
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
          {t('stk.tr.sale.new.back')}
        </button>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
          {t('stk.tr.sale.edit.title').replace('{n}', sale.saleNumber)}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {t('stk.tr.sale.edit.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Read-only summary */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">{t('stk.tr.c.customer')}</span>
            <span className="text-white">{sale.customerName || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">{t('stock.common.items')}</span>
            <span className="text-white">{sale.items.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">{t('stock.common.total')}</span>
            <span className="text-white font-semibold">
              {Number(sale.total).toLocaleString()} DA
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">{t('stock.common.date')}</span>
            <span className="text-white">{new Date(sale.saleDate).toLocaleString()}</span>
          </div>
        </div>

        {/* Payment status */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            {t('stk.tr.c.paymentStatus')}
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
                {s === 'paid' ? t('stock.common.paid') : s === 'pending' ? t('stock.common.pending') : t('stk.tr.c.status.partial')}
              </button>
            ))}
          </div>
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            {t('stk.tr.c.paymentMethod')}
          </label>
          <div className="relative">
            <DollarIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full ps-10 pe-4 py-2.5 bg-black border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="cash">{t('stk.tr.c.pm.cash')}</option>
              <option value="card">{t('stk.tr.c.pm.card')}</option>
              <option value="transfer">{t('stk.tr.c.pm.transfer')}</option>
              <option value="ccp">{t('stk.tr.c.pm.ccp')}</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            {t('stk.tr.c.notes')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={t('stk.tr.sale.edit.notesPh')}
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
            {t('stk.tr.c.cancel')}
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? t('stk.tr.c.saving') : t('stk.tr.sale.edit.submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}
