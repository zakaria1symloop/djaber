'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/stock';
import { Button, Badge } from '@/components/ui';
import { PhoneIcon, ClipboardIcon, BoxIcon, TruckIcon } from '@/components/ui/icons';
import { addOrderCall, updateOrder, type Order } from '@/lib/user-stock-api';
import { useToast } from '@/components/ui/Toast';

interface ConfirmOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged: (order: Order) => void;
}

type CallOutcome = 'confirmed' | 'no_answer' | 'busy' | 'voicemail' | 'rejected';

const OUTCOMES: Array<{
  value: CallOutcome;
  apiValue: string;
  label: string;
  hint: string;
  emoji: string;
  color: 'emerald' | 'amber' | 'red' | 'zinc';
  nextStatus: string | null; // order status to advance to (null = keep)
}> = [
  { value: 'confirmed', apiValue: 'picked_up', label: 'Confirmed', hint: 'Customer wants the order — we\'ll mark it ready to ship', emoji: '✅', color: 'emerald', nextStatus: 'confirmed' },
  { value: 'no_answer', apiValue: 'no_answer', label: 'No answer', hint: 'Logged as attempt — stays in pending queue', emoji: '📵', color: 'amber', nextStatus: null },
  { value: 'busy', apiValue: 'busy', label: 'Busy', hint: 'Try again later — stays in pending queue', emoji: '⏱️', color: 'amber', nextStatus: null },
  { value: 'voicemail', apiValue: 'voicemail', label: 'Voicemail', hint: 'Logged as attempt — stays in pending queue', emoji: '📭', color: 'zinc', nextStatus: null },
  { value: 'rejected', apiValue: 'rejected', label: 'Rejected', hint: 'Customer doesn\'t want it — order will be cancelled', emoji: '❌', color: 'red', nextStatus: 'cancelled' },
];

const STEP_LABELS = ['Review', 'Call outcome', 'Result'];

export default function ConfirmOrderModal({ order, isOpen, onClose, onChanged }: ConfirmOrderModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order && isOpen) {
      setStep(0);
      setOutcome(null);
      setNotes('');
      setEditPhone(order.clientPhone || '');
      setEditAddress(order.clientAddress || '');
      setEditingContact(false);
    }
  }, [order?.id, isOpen]);

  if (!order) return null;

  const remaining = Math.max(0, Number(order.total) - Number(order.amountPaid));
  const selectedOutcome = OUTCOMES.find((o) => o.value === outcome);
  const isAlreadyConfirmed = order.confirmationStatus === 'confirmed';

  const goConfirm = async () => {
    if (!outcome || !selectedOutcome) return;
    setSaving(true);
    try {
      const callRes = await addOrderCall(order.id, {
        result: selectedOutcome.apiValue,
        notes: notes || undefined,
      });
      let updated = callRes.order;

      if (selectedOutcome.nextStatus) {
        const upd = await updateOrder(order.id, { status: selectedOutcome.nextStatus });
        updated = upd.order;
      }

      onChanged(updated);
      setStep(2);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save call outcome');
    } finally {
      setSaving(false);
    }
  };

  const advanceTo = async (status: string) => {
    setSaving(true);
    try {
      const upd = await updateOrder(order.id, { status });
      onChanged(upd.order);
      toast.success(`Order moved to ${status}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="-m-6">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Order</p>
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                #{order.orderNumber}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {new Date(order.orderDate).toLocaleString()} · {order.source === 'ai' ? 'AI chatbot' : 'Manual'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant={statusVariant(order.status)} size="md">
                {prettyStatus(order.status)}
              </Badge>
              {order.callAttempts > 0 && (
                <span className="text-[10px] text-zinc-500">
                  {order.callAttempts} call{order.callAttempts === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-4">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-white text-black ring-2 ring-white/30' : 'bg-white/5 text-zinc-500'
                  }`}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-[11px] font-medium ${i === step ? 'text-white' : i < step ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-white/10 mx-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* STEP 0 — Review */}
          {step === 0 && (
            <div className="space-y-4">
              {/* Customer */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
                    <PhoneIcon className="w-3.5 h-3.5" />
                    Customer
                  </div>
                  <button
                    onClick={() => setEditingContact((v) => !v)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {editingContact ? 'Done' : 'Edit'}
                  </button>
                </div>
                <p className="text-sm font-semibold text-white mb-2">{order.clientName}</p>
                {editingContact ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">Phone</label>
                      <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="0555 12 34 56"
                        className="w-full mt-1 px-3 py-2 bg-black border border-white/10 focus:border-white/30 rounded-lg text-sm text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">Address</label>
                      <textarea
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        rows={2}
                        placeholder="Wilaya, commune, street, building..."
                        className="w-full mt-1 px-3 py-2 bg-black border border-white/10 focus:border-white/30 rounded-lg text-sm text-white focus:outline-none resize-none"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-600">Edits are saved when you log the call outcome.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Phone</p>
                      {order.clientPhone ? (
                        <a
                          href={`tel:${order.clientPhone}`}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {order.clientPhone}
                        </a>
                      ) : (
                        <p className="text-sm text-zinc-600 italic">no phone</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Address</p>
                      <p className="text-sm text-white">{order.clientAddress || <span className="text-zinc-600 italic">no address</span>}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500 px-4 py-2.5 border-b border-white/5">
                  <BoxIcon className="w-3.5 h-3.5" />
                  Items ({order.items.length})
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-b border-white/5 last:border-b-0">
                        <td className="px-4 py-2.5">
                          <span className="text-white">{item.productName}</span>
                          {item.variantName && (
                            <span className="text-xs text-zinc-500 ms-1.5">({item.variantName})</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400 text-center">×{item.quantity}</td>
                        <td className="px-4 py-2.5 text-end text-white font-medium whitespace-nowrap">
                          {Number(item.total).toLocaleString()} DA
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals strip */}
              <div className="grid grid-cols-3 gap-2">
                <Tile label="Total" value={`${Number(order.total).toLocaleString()} DA`} />
                <Tile label="Paid" value={`${Number(order.amountPaid).toLocaleString()} DA`} valueColor="text-emerald-400" />
                <Tile label="Remaining" value={`${remaining.toLocaleString()} DA`} valueColor={remaining > 0 ? 'text-rose-400' : 'text-emerald-400'} />
              </div>

              {order.notes && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-amber-300 mb-1">Notes</p>
                  <p className="text-xs text-zinc-300">{order.notes}</p>
                </div>
              )}

              {order.calls && order.calls.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Previous attempts</p>
                  <div className="space-y-1.5">
                    {order.calls.slice(0, 3).map((call) => (
                      <div key={call.id} className="flex items-center gap-2 text-xs bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                        <span className="text-zinc-500">{new Date(call.calledAt).toLocaleString()}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-300 capitalize">{call.result.replace('_', ' ')}</span>
                        {call.notes && <span className="text-zinc-500 truncate">— {call.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 1 — Outcome */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-white mb-1">How did the call go?</p>
                <p className="text-xs text-zinc-500">We&apos;ll log the attempt and update the order accordingly.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OUTCOMES.map((opt) => {
                  const selected = outcome === opt.value;
                  const colorClasses =
                    opt.color === 'emerald'
                      ? selected ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-emerald-500/20 hover:border-emerald-500/50 text-zinc-300'
                      : opt.color === 'red'
                      ? selected ? 'border-rose-500 bg-rose-500/15 text-rose-300' : 'border-rose-500/20 hover:border-rose-500/50 text-zinc-300'
                      : opt.color === 'amber'
                      ? selected ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-amber-500/20 hover:border-amber-500/50 text-zinc-300'
                      : selected ? 'border-zinc-400 bg-zinc-500/15 text-zinc-200' : 'border-white/10 hover:border-white/30 text-zinc-300';
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setOutcome(opt.value)}
                      className={`text-start p-3 rounded-xl border-2 transition-all ${colorClasses}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{opt.emoji}</span>
                        <span className="text-sm font-semibold">{opt.label}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">{opt.hint}</p>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                  Notes <span className="text-zinc-600 normal-case">(optional, for your records)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    outcome === 'confirmed' ? 'Confirmed delivery time / delivery instructions / payment...'
                      : outcome === 'rejected' ? 'Why did the customer reject?'
                      : 'What happened?'
                  }
                  className="w-full px-3 py-2.5 bg-black border border-white/10 focus:border-white/30 rounded-lg text-sm text-zinc-200 focus:outline-none resize-none"
                />
              </div>

              {outcome === 'confirmed' && !order.clientAddress && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200 flex items-start gap-2">
                  <span>⚠️</span>
                  <span>This order has no delivery address yet. Go back to <em>Review</em> and edit the customer card before confirming.</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Result */}
          {step === 2 && selectedOutcome && (
            <div className="space-y-4">
              <div className={`rounded-2xl p-5 text-center ${resultBg(selectedOutcome.color)}`}>
                <div className="text-4xl mb-2">{selectedOutcome.emoji}</div>
                <p className="text-base font-bold text-white mb-1">
                  {selectedOutcome.value === 'confirmed' && 'Order confirmed'}
                  {selectedOutcome.value === 'rejected' && 'Order cancelled'}
                  {selectedOutcome.value === 'no_answer' && 'No answer logged'}
                  {selectedOutcome.value === 'busy' && 'Busy logged'}
                  {selectedOutcome.value === 'voicemail' && 'Voicemail logged'}
                </p>
                <p className="text-xs text-zinc-400">
                  {selectedOutcome.value === 'confirmed' && 'Ready to send to your delivery provider.'}
                  {selectedOutcome.value === 'rejected' && 'Stock will be restored. Customer was notified.'}
                  {(selectedOutcome.value === 'no_answer' || selectedOutcome.value === 'busy' || selectedOutcome.value === 'voicemail') &&
                    `Attempt #${order.callAttempts + 1} recorded. The order stays in your pending queue.`}
                </p>
              </div>

              {selectedOutcome.value === 'confirmed' && (
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
                    <TruckIcon className="w-3.5 h-3.5" />
                    Next: prepare & ship
                  </div>
                  <p className="text-xs text-zinc-400">
                    Send this order to your delivery provider, or mark it as preparing while you pack it.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled
                      title="Coming soon — Yalidine + ZR Express integration"
                      className="px-3 py-2.5 bg-white/5 border border-white/10 text-zinc-500 rounded-lg text-xs font-medium cursor-not-allowed"
                    >
                      Send to delivery
                      <span className="block text-[9px] text-zinc-600 mt-0.5">Yalidine / ZR — soon</span>
                    </button>
                    <button
                      onClick={() => advanceTo('preparing')}
                      disabled={saving}
                      className="px-3 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      Mark as preparing
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-zinc-950 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {step === 0 && (
              <Button
                onClick={() => setStep(1)}
                disabled={isAlreadyConfirmed}
                title={isAlreadyConfirmed ? 'Already confirmed — no need to call again' : undefined}
              >
                {isAlreadyConfirmed ? 'Already confirmed' : 'Log call outcome'}
              </Button>
            )}
            {step === 1 && (
              <>
                <Button variant="outline" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button
                  onClick={goConfirm}
                  disabled={!outcome || saving || (outcome === 'confirmed' && !order.clientAddress)}
                  loading={saving}
                >
                  Save outcome
                </Button>
              </>
            )}
            {step === 2 && (
              <Button onClick={onClose}>Done</Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Tile({ label, value, valueColor = 'text-white' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-lg p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${valueColor}`} style={{ fontFamily: 'Syne, sans-serif' }}>
        {value}
      </p>
    </div>
  );
}

function statusVariant(status: string): 'success' | 'warning' | 'info' | 'error' | 'default' {
  switch (status) {
    case 'confirmed':
    case 'preparing':
    case 'shipped':
    case 'dispatched':
      return 'info';
    case 'delivered':
      return 'success';
    case 'cancelled':
    case 'returned':
      return 'error';
    default:
      return 'warning';
  }
}

function prettyStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function resultBg(color: 'emerald' | 'amber' | 'red' | 'zinc'): string {
  switch (color) {
    case 'emerald': return 'bg-emerald-500/10 border border-emerald-500/30';
    case 'red': return 'bg-rose-500/10 border border-rose-500/30';
    case 'amber': return 'bg-amber-500/10 border border-amber-500/30';
    default: return 'bg-white/[0.02] border border-white/10';
  }
}
