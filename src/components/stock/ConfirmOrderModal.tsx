'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import {
  PhoneIcon,
  BoxIcon,
  TruckIcon,
  CheckCircleIcon,
  AlertIcon,
  ClockIcon,
  MailIcon,
  BanIcon,
  CloseIcon,
  ClipboardIcon,
  EditIcon,
} from '@/components/ui/icons';
import { addOrderCall, updateOrder, type Order } from '@/lib/user-stock-api';
import { getWilayas, type Wilaya } from '@/lib/delivery-api';
import { useToast } from '@/components/ui/Toast';

interface ConfirmOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged: (order: Order) => void;
}

type CallOutcome = 'confirmed' | 'no_answer' | 'busy' | 'voicemail' | 'rejected';
type OutcomeColor = 'emerald' | 'amber' | 'red' | 'zinc';

const OUTCOMES: Array<{
  value: CallOutcome;
  apiValue: string;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: OutcomeColor;
  nextStatus: string | null;
}> = [
  { value: 'confirmed', apiValue: 'picked_up', label: 'Confirmed', hint: 'Customer wants the order — we\'ll mark it ready to ship.', Icon: CheckCircleIcon, color: 'emerald', nextStatus: 'confirmed' },
  { value: 'no_answer', apiValue: 'no_answer', label: 'No answer', hint: 'Logged as attempt — stays in pending queue.', Icon: PhoneIcon, color: 'amber', nextStatus: null },
  { value: 'busy', apiValue: 'busy', label: 'Busy', hint: 'Try again later — stays in pending queue.', Icon: ClockIcon, color: 'amber', nextStatus: null },
  { value: 'voicemail', apiValue: 'voicemail', label: 'Voicemail', hint: 'Logged as attempt — stays in pending queue.', Icon: MailIcon, color: 'zinc', nextStatus: null },
  { value: 'rejected', apiValue: 'rejected', label: 'Rejected', hint: 'Customer doesn\'t want it — order will be cancelled.', Icon: BanIcon, color: 'red', nextStatus: 'cancelled' },
];

const STEP_LABELS = ['Review', 'Call outcome', 'Result'];

// Module-level cache so we only hit /wilayas once across renders of the modal
let wilayaCache: Wilaya[] | null = null;

export default function ConfirmOrderModal({ order, isOpen, onClose, onChanged }: ConfirmOrderModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wilayas, setWilayas] = useState<Wilaya[]>(wilayaCache || []);

  // Wilayas are static reference data — fetch once, cache forever.
  useEffect(() => {
    if (!isOpen || wilayaCache) return;
    let cancelled = false;
    getWilayas()
      .then((r) => {
        if (cancelled) return;
        wilayaCache = r.wilayas;
        setWilayas(r.wilayas);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

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

  // Lock body scroll while open + ESC to close
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const remaining = Math.max(0, Number(order.total) - Number(order.amountPaid));
  const selectedOutcome = OUTCOMES.find((o) => o.value === outcome);
  const isAlreadyConfirmed = order.confirmationStatus === 'confirmed';

  // Build a human-readable region line: "Commune, Wilaya — Stopdesk".
  // Falls back gracefully when only some pieces are present.
  const wilayaRow = order.wilayaId
    ? wilayas.find((w) => w.id === order.wilayaId) || null
    : null;
  const wilayaLabel = wilayaRow
    ? `${String(wilayaRow.code).padStart(2, '0')} — ${wilayaRow.name}`
    : null;
  const regionParts: string[] = [];
  if (order.communeName) regionParts.push(order.communeName);
  if (wilayaLabel) regionParts.push(wilayaLabel);
  const regionLine = regionParts.join(', ');

  const goConfirm = async () => {
    if (!outcome || !selectedOutcome) return;
    setSaving(true);
    try {
      const callRes = await addOrderCall(order.id, {
        result: selectedOutcome.apiValue,
        notes: notes || undefined,
      });
      let updated = callRes.order;

      // Contact edits from the Review step ("Edits are saved when you log the
      // call outcome") — send whatever differs from the order's current values.
      const contactEdits: { clientPhone?: string; clientAddress?: string } = {};
      if (editPhone.trim() !== (order.clientPhone || '')) contactEdits.clientPhone = editPhone.trim();
      if (editAddress.trim() !== (order.clientAddress || '')) contactEdits.clientAddress = editAddress.trim();
      const hasContactEdits = Object.keys(contactEdits).length > 0;

      if (selectedOutcome.nextStatus) {
        // Merge edits into the status update — one call instead of two
        const upd = await updateOrder(order.id, { status: selectedOutcome.nextStatus, ...contactEdits });
        updated = upd.order;
      } else if (hasContactEdits) {
        // Outcome doesn't change status (no answer / busy / voicemail) —
        // still persist the edited contact details.
        const upd = await updateOrder(order.id, contactEdits);
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
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-3xl my-8 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header — subtle banner with icon chip */}
        <div className="relative px-6 py-5 border-b border-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-zinc-300 flex items-center justify-center flex-shrink-0">
                <ClipboardIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-0.5">Order</p>
                <h2 className="text-xl font-bold text-white leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                  #{order.orderNumber}
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  {new Date(order.orderDate).toLocaleString()}
                  <span className="text-zinc-700"> · </span>
                  {order.source === 'ai' ? 'AI chatbot' : 'Manual'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-[11px] text-zinc-300">
                  {statusVariant(order.status) === 'good' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  {statusVariant(order.status) === 'progress' && <span className="w-1.5 h-1.5 rounded-full border border-zinc-600" />}
                  <span className={statusVariant(order.status) === 'dead' ? 'text-zinc-600' : ''}>{prettyStatus(order.status)}</span>
                </span>
                {order.callAttempts > 0 && (
                  <span className="text-[10px] text-zinc-500">
                    {order.callAttempts} call{order.callAttempts === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-white hover:bg-white/5 transition-colors -mt-1 -me-2 p-1.5 rounded-lg"
                aria-label="Close"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step indicator */}
          <div className="relative flex items-center gap-1 mt-4">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5 flex-1">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    i < step
                      ? 'bg-white text-black'
                      : i === step
                      ? 'bg-white text-black ring-2 ring-white/30'
                      : 'bg-white/5 text-zinc-500'
                  }`}
                >
                  {i < step ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`text-[11px] font-medium whitespace-nowrap ${i === step ? 'text-white' : i < step ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {label}
                </span>
                {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-white/10 mx-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* STEP 0 — Review */}
          {step === 0 && (
            <>
              {/* Customer */}
              <SectionCard
                title="Customer"
                icon={<PhoneIcon className="w-3.5 h-3.5" />}
                action={
                  <button
                    onClick={() => setEditingContact((v) => !v)}
                    className="text-[11px] text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1"
                  >
                    <EditIcon className="w-3 h-3" />
                    {editingContact ? 'Done' : 'Edit'}
                  </button>
                }
              >
                <p className="text-sm font-semibold text-white mb-3">{order.clientName}</p>
                {editingContact ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">Phone</label>
                      <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="0555 12 34 56"
                        className="w-full mt-1 px-3 py-2 bg-black/60 border border-white/10 focus:border-white/30 rounded-lg text-sm text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500">Address</label>
                      <textarea
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        rows={2}
                        placeholder="Wilaya, commune, street, building..."
                        className="w-full mt-1 px-3 py-2 bg-black/60 border border-white/10 focus:border-white/30 rounded-lg text-sm text-white focus:outline-none resize-none"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-600">Edits are saved when you log the call outcome.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Phone</p>
                      {order.clientPhone ? (
                        <a
                          href={`tel:${order.clientPhone}`}
                          className="text-sm text-zinc-300 hover:text-white transition-colors font-mono"
                        >
                          {order.clientPhone}
                        </a>
                      ) : (
                        <p className="text-sm text-zinc-600 italic">no phone</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Address</p>
                      {/*
                        Show the full delivery destination, not just the raw
                        clientAddress string. Region (commune + wilaya) and the
                        Stopdesk flag were previously hidden — see
                        FullAdressMissing.png in the bug report.
                      */}
                      {order.clientAddress || regionLine || order.isStopdesk ? (
                        <div className="space-y-0.5">
                          {order.clientAddress && (
                            <p className="text-sm text-white">{order.clientAddress}</p>
                          )}
                          {regionLine && (
                            <p className="text-xs text-zinc-400">{regionLine}</p>
                          )}
                          {order.isStopdesk && (
                            <p className="text-[10px] inline-block px-1.5 py-0.5 rounded bg-white/[0.03] text-zinc-300 border border-white/10">
                              Stopdesk (agency pickup)
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-600 italic">no address</p>
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* Items */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 px-4 py-2.5 border-b border-white/5">
                  <BoxIcon className="w-3.5 h-3.5" />
                  Items <span className="text-zinc-700">·</span> {order.items.length}
                </div>
                <div className="divide-y divide-white/5">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {item.productName}
                          {item.variantName && (
                            <span className="text-xs text-zinc-500 ms-1.5">({item.variantName})</span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-zinc-400 font-mono whitespace-nowrap">×{item.quantity}</span>
                      <span className="text-sm text-white font-semibold whitespace-nowrap min-w-[80px] text-end">
                        {Number(item.total).toLocaleString()} DA
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-3 gap-2">
                <Tile label="Total" value={`${Number(order.total).toLocaleString()} DA`} />
                <Tile label="Paid" value={`${Number(order.amountPaid).toLocaleString()} DA`} valueColor="text-zinc-300" />
                <Tile
                  label="Remaining"
                  value={`${remaining.toLocaleString()} DA`}
                  valueColor={remaining > 0 ? 'text-white' : 'text-zinc-300'}
                />
              </div>

              {order.notes && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-start gap-2">
                  <AlertIcon className="w-3.5 h-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Notes</p>
                    <p className="text-xs text-zinc-300">{order.notes}</p>
                  </div>
                </div>
              )}

              {order.calls && order.calls.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Previous attempts</p>
                  <div className="space-y-1.5">
                    {order.calls.slice(0, 3).map((call) => (
                      <div
                        key={call.id}
                        className="flex items-center gap-2 text-xs bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2"
                      >
                        <PhoneIcon className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                        <span className="text-zinc-500 whitespace-nowrap">{new Date(call.calledAt).toLocaleString()}</span>
                        <span className="text-zinc-700">·</span>
                        <span className="text-zinc-300 capitalize">{call.result.replace('_', ' ')}</span>
                        {call.notes && <span className="text-zinc-500 truncate">— {call.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 1 — Outcome */}
          {step === 1 && (
            <>
              <div>
                <p className="text-base font-semibold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                  How did the call go?
                </p>
                <p className="text-xs text-zinc-500">We&apos;ll log the attempt and update the order accordingly.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {OUTCOMES.map((opt) => {
                  const selected = outcome === opt.value;
                  const palette = outcomePalette(opt.color, selected);
                  const Icon = opt.Icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setOutcome(opt.value)}
                      className={`text-start p-3.5 rounded-xl border-2 transition-all ${palette.card}`}
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${palette.iconBg}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-sm font-semibold ${palette.label}`}>{opt.label}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-relaxed ps-10">{opt.hint}</p>
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
                    outcome === 'confirmed'
                      ? 'Confirmed delivery time / delivery instructions / payment...'
                      : outcome === 'rejected'
                      ? 'Why did the customer reject?'
                      : 'What happened?'
                  }
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 focus:border-white/30 rounded-lg text-sm text-zinc-200 focus:outline-none resize-none"
                />
              </div>

              {outcome === 'confirmed' && !order.clientAddress && !editAddress.trim() && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-start gap-2">
                  <AlertIcon className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs">
                    <span className="text-white font-semibold">This order has no delivery address yet.</span>{' '}
                    <span className="text-zinc-500">Go back to <em>Review</em> and edit the customer card before confirming.</span>
                  </p>
                </div>
              )}
            </>
          )}

          {/* STEP 2 — Result */}
          {step === 2 && selectedOutcome && (
            <>
              <ResultBanner outcome={selectedOutcome} attempts={order.callAttempts + 1} />

              {selectedOutcome.value === 'confirmed' && (
                <SectionCard
                  title="Next: prepare & ship"
                  icon={<TruckIcon className="w-3.5 h-3.5" />}
                >
                  <p className="text-xs text-zinc-400 mb-3">
                    Send this order to your delivery provider, or mark it as preparing while you pack it.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      disabled
                      title="Coming soon — Yalidine + ZR Express integration"
                      className="px-3 py-2.5 bg-white/5 border border-white/10 text-zinc-500 rounded-lg text-xs font-medium cursor-not-allowed text-start"
                    >
                      <div className="flex items-center gap-2">
                        <TruckIcon className="w-3.5 h-3.5" />
                        <span>Send to delivery</span>
                      </div>
                      <span className="block text-[10px] text-zinc-600 mt-0.5 ps-5">Yalidine / ZR — soon</span>
                    </button>
                    <Button
                      onClick={() => advanceTo('preparing')}
                      disabled={saving}
                      icon={<BoxIcon className="w-3.5 h-3.5" />}
                      size="sm"
                    >
                      Mark as preparing
                    </Button>
                  </div>
                </SectionCard>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-zinc-950 rounded-b-2xl flex items-center justify-between gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {step === 0 && (
              <Button
                size="sm"
                onClick={() => setStep(1)}
                disabled={isAlreadyConfirmed}
                title={isAlreadyConfirmed ? 'Already confirmed — no need to call again' : undefined}
                icon={<PhoneIcon className="w-3.5 h-3.5" />}
              >
                {isAlreadyConfirmed ? 'Already confirmed' : 'Log call outcome'}
              </Button>
            )}
            {step === 1 && (
              <>
                <Button size="sm" variant="outline" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={goConfirm}
                  disabled={!outcome || saving || (outcome === 'confirmed' && !order.clientAddress && !editAddress.trim())}
                  loading={saving}
                  icon={<CheckCircleIcon className="w-3.5 h-3.5" />}
                >
                  Save outcome
                </Button>
              </>
            )}
            {step === 2 && (
              <Button size="sm" onClick={onClose}>Done</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- helpers ---------------------------------------------------------------

function SectionCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
          {icon}
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Tile({ label, value, valueColor = 'text-white' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${valueColor}`} style={{ fontFamily: 'Syne, sans-serif' }}>
        {value}
      </p>
    </div>
  );
}

function ResultBanner({
  outcome,
  attempts,
}: {
  outcome: { value: CallOutcome; Icon: React.ComponentType<{ className?: string }>; color: OutcomeColor };
  attempts: number;
}) {
  const palette = resultPalette(outcome.color);
  const Icon = outcome.Icon;
  const titles: Record<CallOutcome, string> = {
    confirmed: 'Order confirmed',
    rejected: 'Order cancelled',
    no_answer: 'No answer logged',
    busy: 'Busy logged',
    voicemail: 'Voicemail logged',
  };
  const subtitles: Record<CallOutcome, string> = {
    confirmed: 'Ready to send to your delivery provider.',
    rejected: 'Stock will be restored. Customer was notified.',
    no_answer: `Attempt #${attempts} recorded. Stays in your pending queue.`,
    busy: `Attempt #${attempts} recorded. Stays in your pending queue.`,
    voicemail: `Attempt #${attempts} recorded. Stays in your pending queue.`,
  };
  return (
    <div className={`rounded-2xl p-6 text-center border ${palette.bg}`}>
      <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center ${palette.iconBg}`}>
        <Icon className="w-7 h-7" />
      </div>
      <p className="text-base font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
        {titles[outcome.value]}
      </p>
      <p className="text-xs text-zinc-400 max-w-md mx-auto">{subtitles[outcome.value]}</p>
    </div>
  );
}

function statusVariant(status: string): 'good' | 'progress' | 'dead' {
  switch (status) {
    case 'confirmed':
    case 'delivered':
      return 'good';
    case 'cancelled':
    case 'returned':
      return 'dead';
    default:
      return 'progress';
  }
}

function prettyStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Neutral palettes — selection/state is expressed with white borders and
// filled chips, never hue. The outcome word carries the meaning.
function outcomePalette(color: OutcomeColor, selected: boolean) {
  switch (color) {
    case 'emerald':
    case 'red':
    case 'amber':
    default:
      return {
        card: selected
          ? 'border-white/60 bg-white/[0.06] ring-2 ring-white/15'
          : 'border-white/10 hover:border-white/30 bg-white/[0.02]',
        iconBg: selected ? 'bg-white text-black' : 'bg-white/5 text-zinc-300',
        label: 'text-white',
      };
  }
}

function resultPalette(color: OutcomeColor) {
  switch (color) {
    case 'emerald':
    case 'red':
    case 'amber':
    default:
      return { bg: 'bg-white/[0.02] border-white/10', iconBg: 'bg-white/5 text-zinc-300' };
  }
}
