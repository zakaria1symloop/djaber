// Enum → pill colour (Figma "REF — Component sheet"; 02-next-route-map §5 "StatusPill"): money = positive / done,
// inbound = in progress, starred = attention, alert = blocking, muted = neutral, live = AI. One map for every enum:
// a screen never picks a colour ad hoc. Later milestones add their enums here.
import * as React from 'react';
import { Pill, type Tone } from './primitives';

export const PILL_TONES = {
  'Product.state': { active: 'success', inactive: 'neutral', hidden: 'neutral', archived: 'neutral', service: 'neutral' },
  'Product.stock': { ok: 'neutral', low: 'warning', out: 'danger', untracked: 'neutral' },
  'Product.moderationStatus': { not_required: 'neutral', pending: 'warning', approved: 'success', rejected: 'danger', appealed: 'violet' },
  'Product.ai': { proposed: 'success', excluded: 'neutral', outdated: 'warning' },
  'StockMovement.type': { in: 'success', out: 'danger', adjustment_in: 'success', adjustment_out: 'orange', inventory: 'warning', return: 'info' },
  'Job.status': { queued: 'neutral', running: 'info', done: 'success', partial: 'warning', failed: 'danger', cancelled: 'neutral' },
  'Unit.kind': { system: 'neutral', custom: 'success' },
  'Import.row': { ok: 'success', error: 'danger', update: 'info', skip: 'neutral' },
  'Notification.group': { orders: 'success', queue: 'warning', ai: 'danger', stock: 'warning', parcels: 'danger', payments: 'info', pages: 'danger', credits_plan: 'warning', members: 'violet', integrations: 'info', jobs: 'neutral', moderation: 'warning', safety: 'danger', support: 'info', platform: 'neutral' },
  'CustomerBlock.source': { manual: 'neutral', auto_rule: 'warning', platform: 'danger' },
  'AgentInsight.type': { unclear: 'neutral', unknown_topic: 'info', handoff: 'warning', error: 'danger' },
  'DataDeletion.status': { pending: 'warning', done: 'success', not_found: 'danger' },
  'Channel.status': { active: 'success', paused: 'warning', pending_review: 'warning', needs_reconnect: 'danger', disabled: 'neutral', disconnected: 'neutral' },
  'Channel.platform': { facebook: 'info', instagram: 'violet' },
  'Agent.status': { draft: 'neutral', active: 'success', paused: 'warning' },
  'Channel.permission': { granted: 'success', pending: 'warning', missing: 'danger' },
  'Conversation.status': { active: 'success', needs_human: 'warning', resolved: 'neutral', archived: 'neutral' },
  'Client.riskLevel': { normal: 'success', high: 'danger' },
  'Credit.action': { text_reply: 'info', image_recognition: 'warning', voice_transcription: 'violet', reserve: 'neutral', release: 'neutral', renewal: 'neutral', pack_purchase: 'success', grant: 'success', store_refund: 'danger', adjustment: 'orange' },
  'Order.status': { new: 'info', confirmed: 'info', preparing: 'info', shipped: 'orange', delivered: 'success', returned: 'danger', cancelled: 'neutral' },
} as const satisfies Record<string, Record<string, Tone>>;

export type PillEnum = keyof typeof PILL_TONES;

/** Colour of an enum value; unknown values are neutral (a new server value never breaks the screen). */
export const pillTone = (enumKey: PillEnum, value: string): Tone => (PILL_TONES[enumKey] as Record<string, Tone>)[value] ?? 'neutral';

export function StatusPill({ enumKey, value, children, dot, className }: { enumKey: PillEnum; value: string; children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <Pill tone={pillTone(enumKey, value)} dot={dot} className={className}>
      {children}
    </Pill>
  );
}

/** Pill tinted with a stored colour (category colour `#a78bfa`). */
export function ColorPill({ color, children, className }: { color: string; children: React.ReactNode; className?: string }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#888888';
  return (
    <span
      className={['inline-flex max-w-full items-center rounded-[4px] border px-2 py-0.5 ts-label-meta uppercase', className].filter(Boolean).join(' ')}
      style={{ color: safe, borderColor: `${safe}66` }}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
