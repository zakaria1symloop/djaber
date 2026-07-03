'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/stock';
import { getPublicPlans } from '@/lib/user-stock-api';

// Mirrors backend/src/services/credits.service.ts CREDIT_COSTS
const COST = {
  text: 1, // per answered text message
  image: 5, // per image the AI looks at
  voice: 3, // per voice note transcribed
  order: 2, // per order the AI creates
};

interface PlanLite {
  slug: string;
  name: string;
  monthlyCredits?: number;
}

function Row({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <p className="text-sm text-zinc-300">{label}</p>
          <p className="text-[11px] text-zinc-600">{hint}</p>
        </div>
        <span className="text-sm font-mono text-white">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-white h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  );
}

export default function CreditCalculator({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // A "conversation" = one customer chat session.
  const [msgs, setMsgs] = useState(8); // AI text replies per conversation
  const [images, setImages] = useState(1); // photos the customer sends
  const [voice, setVoice] = useState(1); // voice notes
  const [ordersPer100, setOrdersPer100] = useState(20); // conversion rate

  const [plans, setPlans] = useState<PlanLite[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    getPublicPlans()
      .then((r) => setPlans(r.plans.map((p) => ({ slug: p.slug, name: p.name, monthlyCredits: p.monthlyCredits }))))
      .catch(() => {});
  }, [isOpen]);

  const perConversation = useMemo(
    () =>
      msgs * COST.text +
      images * COST.image +
      voice * COST.voice +
      (ordersPer100 / 100) * COST.order,
    [msgs, images, voice, ordersPer100]
  );
  const per1000 = Math.ceil(perConversation * 1000);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Credit calculator" size="md">
      <div className="space-y-5">
        <p className="text-xs text-zinc-500">
          Estimate how many credits your conversations consume. Costs per action: text reply {COST.text} ·
          image {COST.image} · voice note {COST.voice} · AI order {COST.order}.
        </p>

        <div className="space-y-4">
          <Row label="AI replies per conversation" hint="text messages the agent sends" value={msgs} min={1} max={30} onChange={setMsgs} />
          <Row label="Photos per conversation" hint="images the customer sends for the AI to look at" value={images} min={0} max={10} onChange={setImages} />
          <Row label="Voice notes per conversation" hint="transcribed with Whisper" value={voice} min={0} max={10} onChange={setVoice} />
          <Row label="Orders per 100 conversations" hint="how many chats end in an AI-created order" value={ordersPer100} min={0} max={100} onChange={setOrdersPer100} />
        </div>

        {/* Results */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-2 gap-px bg-white/10">
            <div className="bg-[#0c0c0e] px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">Per conversation</p>
              <p className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                {perConversation.toFixed(1)} <span className="text-xs font-normal text-zinc-500">credits</span>
              </p>
            </div>
            <div className="bg-[#0c0c0e] px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1">Per 1000 conversations</p>
              <p className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                {per1000.toLocaleString()} <span className="text-xs font-normal text-zinc-500">credits</span>
              </p>
            </div>
          </div>
        </div>

        {/* Plan coverage */}
        {plans.some((p) => p.monthlyCredits) && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-2">Conversations covered per month</p>
            <div className="space-y-1.5">
              {plans
                .filter((p) => p.monthlyCredits)
                .map((p) => (
                  <div key={p.slug} className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/[0.07] bg-white/[0.02]">
                    <span className="text-sm text-zinc-300">{p.name}</span>
                    <span className="text-sm text-white font-semibold">
                      ≈ {Math.floor((p.monthlyCredits || 0) / perConversation).toLocaleString()}
                      <span className="text-xs font-normal text-zinc-500"> conversations</span>
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
