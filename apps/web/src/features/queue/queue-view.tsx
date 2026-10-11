'use client';
// /queue — Figma "QUEUE — File d'attente — items" + "DLG — Inbox & queue" (File d'attente — vide).
// Left: conversations waiting for a human (`GET /conversations?status=needs_human`) with "Me l'assigner",
// "Reprendre l'IA", "Répondre". Right: problems reported by the agents (`GET /agent-insights?status=pending`,
// served from M4: the column stays empty until then). Failed parcels are not here (12 §4). Live through WS.
import type { ConversationListItemView } from '@djaber/shared';
import { Button, buttonClass, Card, CountHeading, EmptyState, InsightCard, QueueCard, StatusPill, toast } from '@djaber/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { AppPage } from '@/components/app-page';
import { ListLoading, QueryError } from '@/components/global-states';
import type { AgentInsight } from '@/features/inbox/contracts';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/forms';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useSession, useWorkspaceId } from '@/lib/session';
import { relativeTime } from '@/lib/time';
import { queueApi, queueKeys } from './api';
import { queueReason, shortName } from './logic';
import { useQueueEvents } from './shell';

type RowAction = 'assign' | 'resume';

export function QueueView() {
  const t = useT();
  const locale = useLocaleCode();
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  const s = useSession();
  useQueueEvents();

  const conversations = useQuery({ queryKey: queueKeys.conversations(ws), queryFn: queueApi.needsHuman, enabled: !!ws && s.can('inbox.read') });
  const insights = useQuery({ queryKey: queueKeys.insights(ws), queryFn: queueApi.insights, enabled: !!ws && s.can('inbox.read'), staleTime: 60_000, retry: false });

  const act = useMutation({
    mutationFn: async ({ row, action }: { row: ConversationListItemView; action: RowAction }) => {
      // the list row carries `version`; an older payload without it is completed from the conversation itself
      const version = row.version ?? (await queueApi.conversation(row.id)).version;
      return queueApi.patch(row.id, action === 'assign' ? { assigneeId: s.me!.id, version } : { aiPaused: false, status: 'active', version });
    },
  });
  const run = async (row: ConversationListItemView, action: RowAction) => {
    try {
      await act.mutateAsync({ row, action });
      toast(action === 'assign' ? t('queue.assigned', { name: shortName(row.client?.name) }) : t('queue.resumed', { name: shortName(row.client?.name) }));
    } catch (e) {
      // 409 CONFLICT: a teammate handled the conversation meanwhile — the list is simply refreshed
      toast({ tone: e instanceof ApiError && e.status === 409 ? 'warning' : 'danger', message: e instanceof ApiError && e.code === 'CONFLICT' ? t('queue.conflict') : errorMessage(e, t) });
    } finally {
      void qc.invalidateQueries({ queryKey: queueKeys.all(ws) });
    }
  };

  const rows = conversations.data ?? [];
  const problems = insights.data?.rows ?? [];
  const problemCount = insights.data?.total ?? 0;
  const minutes = s.workspace?.handoffReminderMin ?? 0;
  const writeReason = s.readOnly ? t('error.READ_ONLY_MEMBER') : undefined;
  const busyId = act.isPending ? act.variables?.row.id : null;

  return (
    <AppPage
      wide
      permission="inbox.read"
      title={t('nav.queue')}
      description={
        <span data-testid="queue-summary">
          {t('queue.summary', { conversations: rows.length, insights: problemCount })}
          {' · '}
          {minutes > 0 ? t('queue.reminder', { minutes }) : t('queue.reminderOff')}
        </span>
      }
      actions={
        s.can('workspace.settings') ? (
          <Link href="/settings/workspace" className={buttonClass({ variant: 'ghost' })} data-testid="queue-reminder-settings">
            {t('queue.reminderSettings')}
          </Link>
        ) : null
      }
    >
      {conversations.isPending ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <ListLoading rows={5} columns={3} />
          </Card>
          <Card className="max-lg:hidden">
            <ListLoading rows={5} columns={3} />
          </Card>
        </div>
      ) : conversations.isError ? (
        <QueryError error={conversations.error} onRetry={() => void conversations.refetch()} />
      ) : rows.length === 0 && problems.length === 0 ? (
        <EmptyState icon={<Check className="size-6 text-accent-money" />} title={t('state.queue.empty.title')} description={t('state.queue.empty.description')} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section aria-label={t('queue.conversations.title')} className="flex flex-col gap-3" data-testid="queue-conversations">
            <CountHeading count={rows.length}>{t('queue.conversations.title')}</CountHeading>
            {rows.length === 0 ? <p className="px-5 text-[13px] text-text-muted">{t('queue.conversations.empty')}</p> : null}
            {rows.map((row) => {
              const reason = queueReason(row.handoffReason);
              const mine = !!row.assignee && row.assignee.id === s.me?.id;
              const busy = busyId === row.id;
              return (
                <QueueCard
                  key={row.id}
                  data-conversation={row.id}
                  label={
                    <>
                      {t(`queue.reason.${reason.kind}`)}
                      {reason.detail ? <bdi> · {reason.detail}</bdi> : null}
                    </>
                  }
                  age={row.lastMessageAt ? relativeTime(row.lastMessageAt, locale) : '—'}
                  title={
                    <>
                      <bdi>{shortName(row.client?.name) || t('queue.unknownClient')}</bdi> · <bdi>{row.channel.name}</bdi>
                    </>
                  }
                  preview={row.lastMessagePreview}
                  meta={row.assignee ? t('queue.assignee', { name: shortName(`${row.assignee.firstName} ${row.assignee.lastName}`) }) : t('queue.unassigned')}
                  actions={
                    <>
                      {mine ? null : (
                        <Button variant="ghost" size="sm" onClick={() => void run(row, 'assign')} disabled={busy} disabledReason={writeReason} data-action="assign">
                          {t('queue.action.assignMe')}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => void run(row, 'resume')} disabled={busy} disabledReason={writeReason} data-action="resume">
                        {t('action.resumeAi')}
                      </Button>
                      <Link href={`/inbox/${row.id}`} className={buttonClass({ variant: 'primary', size: 'sm' })} data-action="reply">
                        {t('queue.action.reply')}
                      </Link>
                    </>
                  }
                />
              );
            })}
          </section>

          <section aria-label={t('queue.insights.title')} className="flex flex-col gap-3" data-testid="queue-insights">
            <CountHeading count={problemCount}>{t('queue.insights.title')}</CountHeading>
            {problems.map((i) => (
              <Insight key={i.id} insight={i} />
            ))}
          </section>
        </div>
      )}
    </AppPage>
  );
}

function Insight({ insight }: { insight: AgentInsight }) {
  const t = useT();
  const locale = useLocaleCode();
  const who = [shortName(insight.client?.name), insight.agent?.name].filter(Boolean).join(' · ');
  return (
    <InsightCard
      data-insight={insight.id}
      pill={
        <StatusPill enumKey="AgentInsight.type" value={insight.type} className="!rounded-[4px]">
          {t(`enum.AgentInsight.type.${insight.type}`)}
        </StatusPill>
      }
      who={who}
      age={relativeTime(insight.createdAt, locale)}
      quote={`« ${insight.customerMessage || '—'} »`}
      detail={insight.detail ?? insight.aiResponse}
      actions={
        // M4: "Ajouter aux instructions" and "Ignorer" (POST /agent-insights/:id/resolve) come with the agents module
        <Link href={`/inbox/${insight.conversationId}`} className={buttonClass({ size: 'sm' })}>
          {t('action.open')}
        </Link>
      }
    />
  );
}
