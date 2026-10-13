'use client';
// Outbound webhooks card (API-03, AT-API-02; Figma "SET — Settings — Integrations" block "Webhooks sortants" + DLG
// "Webhook sortant"): endpoints with events and status, disabled banner (50 failures) + Réactiver, add / edit (URL,
// events), signing secret shown once (create, Régénérer), test ping, delete; deliveries journal of every endpoint with
// its filters in the URL (`endpoint`, `status`, `event`, `page`), payload view and Rejouer. Plan feature `webhooks`.
import { formatDateTime, formatNumber, WEBHOOK_EVENTS, type WebhookCreatedDto, type WebhookDeliveryDto, type WebhookEndpointDto } from '@djaber/shared';import { ActionsMenu, Button, Card, ConfirmDialog, ConnectionNote, DeliveryLogRow, Dialog, FormAlert, IntegrationRow, MonoChip, Pagination, SecretOnce, Select, toast } from '@djaber/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ListEmpty, ListFilteredEmpty, ListLoading, QueryError } from '@/components/global-states';
import { actionState, toMenuActions } from '@/lib/actions';
import { errorMessage } from '@/lib/forms';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useWorkspaceId } from '@/lib/session';
import { uuid } from '@/lib/uuid';
import { integrationKeys, integrationsApi, useDeliveries, useWebhooks } from './api';
import { CardSkeleton, IntegrationCard, PlanGate } from './common';
import { deliveryResult, journalTime } from './logic';
import { WebhookDialog } from './webhook-dialog';

const DELIVERY_STATUSES = ['pending', 'success', 'failed', 'exhausted'] as const;

export function WebhooksTab() {
  const t = useT();
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  const q = useWebhooks();
  const [editing, setEditing] = useState<WebhookEndpointDto | 'new' | null>(null);
  const [secret, setSecret] = useState<WebhookCreatedDto | null>(null);
  const [toDelete, setToDelete] = useState<WebhookEndpointDto | null>(null);
  const [toRotate, setToRotate] = useState<WebhookEndpointDto | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const del = useMutation({ mutationFn: integrationsApi.deleteWebhook });
  const rotate = useMutation({ mutationFn: integrationsApi.rotateWebhookSecret });
  const enable = useMutation({ mutationFn: integrationsApi.enableWebhook });
  const test = useMutation({ mutationFn: (id: string) => integrationsApi.testWebhook(id, uuid()) });
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: integrationKeys.webhooks(ws) });
    void qc.invalidateQueries({ queryKey: integrationKeys.deliveries(ws) });
  };
  const setFilter = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const runTest = async (e: WebhookEndpointDto) => {
    try {
      await test.mutateAsync(e.id);
      toast({ tone: 'info', message: t('settings.integrations.webhooks.testSent') });
      setFilter({ endpoint: e.id, status: null, event: null });
      refresh();
    } catch (err) {
      toast({ tone: 'danger', message: errorMessage(err, t) });
    }
  };
  const runEnable = async (e: WebhookEndpointDto) => {
    try {
      await enable.mutateAsync(e.id);
      toast({ tone: 'success', message: t('settings.integrations.webhooks.enabled', { url: e.url }) });
    } catch (err) {
      toast({ tone: 'danger', message: errorMessage(err, t) });
    } finally {
      refresh();
    }
  };

  if (q.isPending) return <CardSkeleton rows={4} label={t('settings.integrations.webhooks.title')} />;
  if (q.isError) return <QueryError error={q.error} onRetry={() => q.refetch()} />;
  const data = q.data;
  const create = actionState(data.actions, 'create', t);
  const disabled = data.endpoints.filter((e) => e.status === 'disabled');
  const allowance = data.limit < 0 ? t('settings.integrations.apiKeys.allowanceUnlimited', { used: formatNumber(data.used) }) : t('settings.integrations.webhooks.allowance', { used: formatNumber(data.used), limit: formatNumber(data.limit) });

  const menu = (e: WebhookEndpointDto) =>
    toMenuActions(
      e.actions,
      {
        deliveries: { label: t('settings.integrations.webhooks.action.deliveries'), onSelect: () => setFilter({ endpoint: e.id, status: null, event: null }) },
        edit: { label: t('action.edit'), onSelect: () => setEditing(e) },
        test: { label: t('action.test'), onSelect: () => void runTest(e) },
        rotate_secret: { label: t('settings.integrations.webhooks.action.rotate'), onSelect: () => (setDialogError(null), setToRotate(e)) },
        enable: { label: t('action.enable'), onSelect: () => void runEnable(e) },
        delete: { label: t('action.delete'), destructive: true, separated: true, onSelect: () => (setDialogError(null), setToDelete(e)) },
      },
      t,
    );

  return (
    <>
      <IntegrationCard
        testId="webhooks-card"
        title={t('settings.integrations.webhooks.title')}
        description={t('settings.integrations.webhooks.description')}
        status={<span className="ts-label-meta text-text-muted" data-testid="webhooks-allowance">{allowance}</span>}
        action={
          create.present ? (
            <Button variant="primary" onClick={() => setEditing('new')} disabledReason={create.reason} data-testid="webhook-add">
              {t('settings.integrations.webhooks.add')}
            </Button>
          ) : undefined
        }
      >
        {!data.featureEnabled ? <PlanGate feature="webhooks" /> : null}
        {disabled.map((e) => {
          const en = actionState(e.actions, 'enable', t);
          return (
            <ConnectionNote
              key={e.id}
              tone="danger"
              label={t('settings.integrations.webhooks.disabledLabel')}
              action={
                en.present ? (
                  <Button size="sm" onClick={() => void runEnable(e)} disabledReason={en.reason} loading={enable.isPending && enable.variables === e.id} data-testid="webhook-enable">
                    {t('action.enable')}
                  </Button>
                ) : undefined
              }
            >
              <span data-testid="webhook-disabled-banner" data-endpoint={e.id}>
                {t('settings.integrations.webhooks.disabledText', { url: e.url, count: e.disableAfter, code: e.lastFailure?.responseCode ? String(e.lastFailure.responseCode) : (e.lastFailure?.error ?? '—') })}
              </span>
            </ConnectionNote>
          );
        })}
        {data.endpoints.length === 0 ? (
          <ListEmpty title={t('settings.integrations.webhooks.empty')} description={t('settings.integrations.webhooks.emptyHint')} />
        ) : (
          <ul className="divide-y divide-line-hairline overflow-hidden rounded-card border border-line-edge" data-testid="webhooks">
            {data.endpoints.map((e) => (
              <IntegrationRow
                key={e.id}
                data-testid="webhook-row"
                data-endpoint={e.id}
                data-status={e.status}
                title={
                  <bdi dir="ltr" title={e.url}>
                    {e.url}
                  </bdi>
                }
                meta={
                  <span dir="ltr" title={e.events.join(' · ')}>
                    {e.events.join(' · ')}
                  </span>
                }
                status={
                  <MonoChip tone={e.status === 'active' ? 'success' : 'danger'} title={e.failureCount ? t('settings.integrations.webhooks.failures', { count: e.failureCount, max: e.disableAfter }) : undefined}>
                    {e.status === 'active' ? t('settings.integrations.webhooks.status.active') : t('settings.integrations.webhooks.status.disabled')}
                  </MonoChip>
                }
                actions={<ActionsMenu label={t('action.actions')} actions={menu(e)} />}
              />
            ))}
          </ul>
        )}
        <p className="ts-label-meta text-text-muted">{t('settings.integrations.webhooks.signatureHint')}</p>
      </IntegrationCard>

      <DeliveriesJournal endpoints={data.endpoints} filter={params} setFilter={setFilter} />

      <WebhookDialog
        target={editing}
        events={data.events.length ? data.events : WEBHOOK_EVENTS}
        onClose={() => setEditing(null)}
        onSaved={(created) => {
          refresh();
          setEditing(null);
          if (created) setSecret(created);
          else toast(t('toast.saved'));
        }}
        onRotate={(e) => (setDialogError(null), setToRotate(e))}
        onTest={(e) => void runTest(e)}
      />

      <Dialog
        open={!!secret}
        onOpenChange={(o) => !o && setSecret(null)}
        title={t('settings.integrations.webhooks.secretTitle')}
        description={secret?.url}
        closeLabel={t('action.close')}
        footer={
          <Button variant="primary" onClick={() => setSecret(null)} data-testid="webhook-secret-done">
            {t('action.close')}
          </Button>
        }
      >
        {secret ? (
          <div className="flex flex-col gap-3">
            <SecretOnce value={secret.secret} note={t('settings.integrations.webhooks.secretOnce')} copyLabel={t('action.copy')} copiedLabel={t('toast.copied')} onCopied={() => toast(t('toast.copied'))} testId="webhook-secret" />
            <p className="ts-label-meta text-text-muted">{t('settings.integrations.webhooks.signatureHint')}</p>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={!!toRotate}
        onOpenChange={(o) => !o && setToRotate(null)}
        title={t('settings.integrations.webhooks.rotateTitle')}
        description={t('settings.integrations.webhooks.rotateText', { url: toRotate?.url ?? '' })}
        confirmLabel={t('settings.integrations.webhooks.action.rotate')}
        cancelLabel={t('action.cancel')}
        closeLabel={t('action.close')}
        loading={rotate.isPending}
        onConfirm={async () => {
          if (!toRotate) return;
          setDialogError(null);
          try {
            const created = await rotate.mutateAsync(toRotate.id);
            setToRotate(null);
            setEditing(null);
            setSecret(created);
            refresh();
          } catch (e) {
            setDialogError(errorMessage(e, t));
          }
        }}
      >
        {dialogError ? <FormAlert>{dialogError}</FormAlert> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('settings.integrations.webhooks.deleteTitle')}
        description={t('settings.integrations.webhooks.deleteText', { url: toDelete?.url ?? '' })}
        confirmLabel={t('action.delete')}
        cancelLabel={t('action.cancel')}
        closeLabel={t('action.close')}
        destructive
        loading={del.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          setDialogError(null);
          try {
            await del.mutateAsync(toDelete.id);
            if (params.get('endpoint') === toDelete.id) setFilter({ endpoint: null });
            setToDelete(null);
            refresh();
            toast(t('settings.integrations.webhooks.deleted'));
          } catch (e) {
            setDialogError(errorMessage(e, t));
          }
        }}
      >
        {dialogError ? <FormAlert>{dialogError}</FormAlert> : null}
      </ConfirmDialog>
    </>
  );
}

/** "JOURNAL DES LIVRAISONS · erp.amel.dz" — every endpoint, newest first; filters live in the URL. */
function DeliveriesJournal({ endpoints, filter, setFilter }: { endpoints: WebhookEndpointDto[]; filter: URLSearchParams; setFilter: (patch: Record<string, string | null>) => void }) {
  const t = useT();
  const locale = useLocaleCode() as 'fr' | 'ar' | 'en';
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  const endpointId = filter.get('endpoint');
  const status = filter.get('status');
  const event = filter.get('event');
  const page = Math.max(1, Number(filter.get('page')) || 1);
  const knownEndpoint = endpointId && endpoints.some((e) => e.id === endpointId) ? endpointId : null;
  const validStatus = status && (DELIVERY_STATUSES as readonly string[]).includes(status) ? status : null;
  const query = useMemo(
    () => ({ page, pageSize: 25, ...(knownEndpoint ? { endpointId: knownEndpoint } : {}), ...(validStatus ? { status: validStatus } : {}), ...(event ? { event } : {}) }),
    [knownEndpoint, validStatus, event, page],
  );
  const q = useDeliveries(query, endpoints.length > 0);
  const [payload, setPayload] = useState<WebhookDeliveryDto | null>(null);
  const replay = useMutation({ mutationFn: (id: string) => integrationsApi.replayDelivery(id, uuid()) });
  const filtered = !!(knownEndpoint || validStatus || event);
  const host = (() => {
    const e = endpoints.find((x) => x.id === knownEndpoint);
    if (!e) return null;
    try {
      return new URL(e.url).host;
    } catch {
      return e.url;
    }
  })();

  if (endpoints.length === 0) return null;
  const rows = q.data?.rows ?? [];
  return (
    <Card className="flex min-w-0 flex-col" data-testid="deliveries">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-hairline px-4 py-3">
        <h3 className="ts-label-micro uppercase text-text-muted">
          {t('settings.integrations.webhooks.journal.title')}
          {host ? (
            <>
              {' · '}
              <bdi dir="ltr" className="normal-case">
                {host}
              </bdi>
            </>
          ) : null}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label={t('settings.integrations.webhooks.journal.endpoint')} className="!h-8 w-auto max-w-[16rem] text-[12px]" value={knownEndpoint ?? ''} onChange={(e) => setFilter({ endpoint: e.target.value || null })} data-testid="deliveries-endpoint">
            <option value="">{t('settings.integrations.webhooks.journal.allEndpoints')}</option>
            {endpoints.map((e) => (
              <option key={e.id} value={e.id}>
                {e.url}
              </option>
            ))}
          </Select>
          <Select aria-label={t('settings.integrations.webhooks.journal.status')} className="!h-8 w-auto text-[12px]" value={validStatus ?? ''} onChange={(e) => setFilter({ status: e.target.value || null })} data-testid="deliveries-status">
            <option value="">{t('settings.integrations.webhooks.journal.allStatuses')}</option>
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`settings.integrations.webhooks.delivery.${s}`)}
              </option>
            ))}
          </Select>
          <Select aria-label={t('settings.integrations.webhooks.journal.event')} className="!h-8 w-auto text-[12px]" value={event ?? ''} onChange={(e) => setFilter({ event: e.target.value || null })} data-testid="deliveries-event">
            <option value="">{t('settings.integrations.webhooks.journal.allEvents')}</option>
            {['ping', ...WEBHOOK_EVENTS].map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {q.isPending ? (
        <ListLoading rows={4} columns={3} />
      ) : q.isError ? (
        <div className="p-4">
          <QueryError error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          {filtered ? (
            <ListFilteredEmpty entity={t('settings.integrations.webhooks.journal.entity')} filters={[host, validStatus ? t(`settings.integrations.webhooks.delivery.${validStatus}`) : null, event].filter(Boolean).join(' · ')} onClear={() => setFilter({ endpoint: null, status: null, event: null })} />
          ) : (
            <ListEmpty title={t('settings.integrations.webhooks.journal.empty')} description={t('settings.integrations.webhooks.journal.emptyHint')} />
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line-hairline" aria-busy={q.isFetching}>
            {rows.map((d) => {
              const r = deliveryResult(d, t, locale);
              const label = `${d.event}${d.summary ? ` · ${d.summary}` : ''}`;
              return (
                <DeliveryLogRow
                  key={d.id}
                  data-testid="delivery-row"
                  data-delivery={d.id}
                  data-status={d.status}
                  data-event={d.event}
                  time={journalTime(d.createdAt, locale, t)}
                  label={
                    <span title={`${label} → ${d.endpointUrl}`}>
                      <bdi dir="ltr">{d.event}</bdi>
                      {d.summary ? (
                        <>
                          {' · '}
                          <bdi dir="auto">{d.summary}</bdi>
                        </>
                      ) : null}
                      {d.replayOfId ? <span className="text-text-muted"> · {t('settings.integrations.webhooks.journal.replayed')}</span> : null}
                    </span>
                  }
                  result={<span title={d.error ?? undefined}>{r.text}</span>}
                  tone={r.tone}
                  actions={
                    <ActionsMenu
                      label={t('action.actions')}
                      actions={toMenuActions(
                        d.actions,
                        {
                          replay: {
                            label: t('action.replay'),
                            onSelect: async () => {
                              try {
                                await replay.mutateAsync(d.id);
                                toast({ tone: 'info', message: t('settings.integrations.webhooks.replayed', { event: d.event }) });
                              } catch (e) {
                                toast({ tone: 'danger', message: errorMessage(e, t) });
                              } finally {
                                void qc.invalidateQueries({ queryKey: integrationKeys.deliveries(ws) });
                              }
                            },
                          },
                          payload: { label: t('settings.integrations.webhooks.action.payload'), local: true, onSelect: () => setPayload(d) },
                        },
                        t,
                      )}
                    />
                  }
                />
              );
            })}
          </ul>
          {(q.data?.total ?? 0) > 25 ? (
            <Pagination
              page={page}
              pageSize={25}
              total={q.data?.total ?? 0}
              onPageChange={(p) => setFilter({ page: p > 1 ? String(p) : null })}
              labels={{ previous: t('action.previousPage'), next: t('action.nextPage'), perPage: (n) => t('common.perPage', { count: n }), range: (a, b, total) => t('common.rangeOf', { from: a, to: b, total }) }}
            />
          ) : null}
        </>
      )}
      <Dialog open={!!payload} onOpenChange={(o) => !o && setPayload(null)} title={t('settings.integrations.webhooks.payloadTitle', { event: payload?.event ?? '' })} description={payload?.endpointUrl} closeLabel={t('action.close')} size="lg">
        {payload ? (
          <div className="flex flex-col gap-3" data-testid="delivery-payload">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
              <dt className="ts-label-micro uppercase text-text-muted">{t('settings.integrations.webhooks.journal.status')}</dt>
              <dd>{t(`settings.integrations.webhooks.delivery.${payload.status}`)} · {deliveryResult(payload, t, locale).text}</dd>
              <dt className="ts-label-micro uppercase text-text-muted">{t('settings.integrations.webhooks.journal.sentAt')}</dt>
              <dd>{formatDateTime(payload.createdAt, locale)}</dd>
              {payload.error ? (
                <>
                  <dt className="ts-label-micro uppercase text-text-muted">{t('settings.integrations.webhooks.journal.error')}</dt>
                  <dd className="text-accent-alert [overflow-wrap:anywhere]">{payload.error}</dd>
                </>
              ) : null}
            </dl>
            <pre dir="ltr" className="max-h-80 overflow-auto rounded-card border border-line-edge bg-ink-base p-3 font-mono text-[12px] leading-relaxed">
              {JSON.stringify(payload.payload, null, 2)}
            </pre>
          </div>
        ) : null}
      </Dialog>
    </Card>
  );
}
