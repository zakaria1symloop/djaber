'use client';
// /agent-test/[token] — public shared playground (Figma "AGT-07", shared read-only variant: no inspector, no scenario,
// no tool chips; "DLG — Agents & channels" Lien de test). A colleague opens the 24 h link without an account and
// chats with the agent in dry-run: `GET /agent-test/:token` → agent + expiry, `POST /agent-test/:token/messages`.
// States: intro card · conversation · typing · real cards · expired link (410 `AGENT_TEST_LINK_EXPIRED`) · rate limited.
import { AgentAvatar, Card, ErrorState, Ltr, MonoChip, Skeleton, StateBlock } from '@djaber/ui';
import { formatDateTime, type AppLocale } from '@djaber/shared';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useCallback } from 'react';
import { LocaleSwitch } from '@/components/auth/auth-card';
import { Logo } from '@/components/shell/sidebar';
import { ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/document-title';
import { useLocaleCode, useT } from '@/lib/i18n';
import { sharedTestApi } from '../api';
import type { TurnView } from '../logic';
import { PlaygroundComposer, PlaygroundThread, usePlayground, type ChatTransport } from './chat';

const replyView = (r: { reply: string; cards: { productId: string; name: string; price: number; imageUrl: string | null; variantLabel?: string | null }[] }): TurnView => ({
  reply: r.reply,
  status: 'OK',
  intent: '',
  confidence: 0,
  model: '',
  tokens: { input: 0, output: 0 },
  latencyMs: 0,
  tools: [],
  simulatedTools: 0,
  cards: (r.cards ?? []).map((c) => ({ id: c.productId, name: c.name, price: c.price, imageUrl: c.imageUrl, variants: c.variantLabel ?? null })),
  creditsInProd: 0,
  language: '',
  prompt: [],
  systemMessages: [],
  turnId: null,
});
const isExpired = (e: unknown) => e instanceof ApiError && (e.status === 410 || e.code === 'AGENT_TEST_LINK_EXPIRED' || e.status === 404);

export function SharedTest({ token }: { token: string }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  useDocumentTitle(t('agents.shared.title'));
  const q = useQuery({ queryKey: ['public', 'agent-test', token], queryFn: () => sharedTestApi.get(token, locale), retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 1 });
  const transport = useCallback<ChatTransport>(async (history, input) => replyView(await sharedTestApi.send(token, locale, { text: input.text, history: history.map((h) => ({ role: h.role, text: h.text })) })), [token, locale]);
  const pg = usePlayground(transport);
  // the link may expire while the page is open: the next message answers 410
  const expiredLater = pg.entries.some((e) => e.role === 'error' && e.code === 'AGENT_TEST_LINK_EXPIRED');
  const expired = (q.isError && isExpired(q.error)) || expiredLater;
  const state = q.isPending ? 'loading' : expired ? 'expired' : q.isError ? 'error' : pg.wait > 0 ? 'rate-limited' : pg.entries.length ? 'conversation' : 'intro';

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4" data-testid="shared-test" data-state={state}>
      <header className="flex items-center gap-2.5">
        <Logo compact />
        <div className="ts-display-s text-[19px] leading-none">
          Djaber<span className="text-text-secondary">.ai</span>
        </div>
        <span className="flex-1" />
        <MonoChip tone="warning">{t('agents.playground.simulation')}</MonoChip>
      </header>
      {q.isPending ? (
        <Card role="status" aria-label={t('common.loading')} className="flex flex-col gap-3 p-6">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-40" />
        </Card>
      ) : expired ? (
        <StateBlock icon={<Clock className="size-5" />} title={t('agents.shared.expired.title')} description={`${t('error.AGENT_TEST_LINK_EXPIRED')} ${t('agents.shared.expired.description')}`} />
      ) : q.isError ? (
        <ErrorState title={t('state.list.error.title')} description={t('state.list.error.description', { ref: q.error instanceof ApiError ? q.error.body.ref || '—' : '—' })} action={{ label: t('action.retry'), onClick: () => void q.refetch() }} />
      ) : (
        <Card className="flex h-[min(78vh,46rem)] min-h-[26rem] flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line-hairline px-4 py-3" data-testid="shared-intro">
            <AgentAvatar name={q.data.agentName} src={q.data.avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate ts-title">{q.data.agentName}</h1>
              <p className="ts-label-meta mt-1 text-text-muted">
                <Ltr>{t('agents.shared.expires', { date: formatDateTime(q.data.expiresAt, locale) })}</Ltr>
              </p>
            </div>
          </div>
          <PlaygroundThread pg={pg} agentName={q.data.agentName} showTools={false} empty={t('agents.shared.intro')} className="pt-2" />
          <div className="border-t border-line-hairline p-3">
            <PlaygroundComposer pg={pg} placeholder={t('agents.playground.placeholder')} />
          </div>
        </Card>
      )}
      <p className="text-center ts-label-meta text-text-muted">{t('agents.shared.note')}</p>
      <LocaleSwitch />
    </div>
  );
}
