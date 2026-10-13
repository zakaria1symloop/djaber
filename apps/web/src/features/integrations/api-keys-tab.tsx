'use client';
// API keys card (API-01 / API-02, AT-API-01; Figma "SET — Settings — Integrations" block "Clés API" + "CRÉER UNE CLÉ
// (DIALOGUE)"): list with plan allowance, create (name, environment, scopes) → the full key shown once, revoke.
// "Créer une clé" and "Révoquer" follow the server actions (PLAN_FEATURE_REQUIRED, PLAN_LIMIT, CONFLICT).
import { zodResolver } from '@hookform/resolvers/zod';
import { API_SCOPES, CreateApiKeySchema, formatDate, formatNumber, type ApiKeyCreatedDto, type ApiKeyDto, type ApiScope, type CreateApiKeyInput } from '@djaber/shared';
import { ActionsMenu, Button, CheckChip, ConfirmDialog, Dialog, Field, FormAlert, Input, IntegrationRow, MonoChip, SecretOnce, SegmentedControl, toast } from '@djaber/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ListEmpty, QueryError } from '@/components/global-states';
import { actionState, toMenuActions } from '@/lib/actions';
import { applyServerErrors, errorMessage, fieldError, useLeaveGuard } from '@/lib/forms';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useWorkspaceId } from '@/lib/session';
import { relativeTime } from '@/lib/time';
import { integrationKeys, integrationsApi, useApiKeys } from './api';
import { CardSkeleton, IntegrationCard, PlanGate } from './common';

export function ApiKeysTab() {
  const t = useT();
  const locale = useLocaleCode() as 'fr' | 'ar' | 'en';
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  const q = useApiKeys();
  const [creating, setCreating] = useState(false);
  const [toRevoke, setToRevoke] = useState<ApiKeyDto | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const revoke = useMutation({ mutationFn: integrationsApi.revokeApiKey });

  if (q.isPending) return <CardSkeleton rows={3} label={t('settings.integrations.apiKeys.title')} />;
  if (q.isError) return <QueryError error={q.error} onRetry={() => q.refetch()} />;
  const data = q.data;
  const create = actionState(data.actions, 'create', t);
  const allowance = data.limit < 0 ? t('settings.integrations.apiKeys.allowanceUnlimited', { used: formatNumber(data.used) }) : t('settings.integrations.apiKeys.allowance', { used: formatNumber(data.used), limit: formatNumber(data.limit) });

  const meta = (k: ApiKeyDto) => {
    const scopes = k.scopes.join(' · ');
    if (k.status === 'revoked') return `${scopes} · ${t('settings.integrations.apiKeys.revokedOn', { date: k.revokedAt ? formatDate(k.revokedAt, locale) : '—' })}`;
    return `${scopes} · ${k.lastUsedAt ? t('settings.integrations.apiKeys.lastUsed', { ago: relativeTime(k.lastUsedAt, locale) }) : t('settings.integrations.apiKeys.neverUsed')}`;
  };

  return (
    <>
      <IntegrationCard
        testId="api-keys-card"
        title={t('settings.integrations.apiKeys.title')}
        description={t('settings.integrations.apiKeys.description', { rate: formatNumber(data.rateLimitPerMinute) })}
        status={<span className="ts-label-meta text-text-muted" data-testid="api-keys-allowance">{allowance}</span>}
        action={
          create.present ? (
            <Button variant="primary" onClick={() => setCreating(true)} disabledReason={create.reason} data-testid="api-key-create">
              {t('settings.integrations.apiKeys.create')}
            </Button>
          ) : undefined
        }
      >
        {!data.featureEnabled ? <PlanGate feature="api_keys" /> : null}
        {data.keys.length === 0 ? (
          <ListEmpty title={t('settings.integrations.apiKeys.empty')} description={t('settings.integrations.apiKeys.emptyHint')} />
        ) : (
          <ul className="divide-y divide-line-hairline overflow-hidden rounded-card border border-line-edge" data-testid="api-keys">
            {data.keys.map((k) => (
              <IntegrationRow
                key={k.id}
                data-testid="api-key-row"
                data-key={k.id}
                data-status={k.status}
                muted={k.status === 'revoked'}
                title={
                  <span title={`${k.name} · ${k.prefix}…`}>
                    <bdi dir="auto">{k.name}</bdi> · <bdi dir="ltr">{k.prefix}…</bdi>
                  </span>
                }
                meta={<span title={meta(k)}>{meta(k)}</span>}
                status={
                  k.status === 'revoked' ? (
                    <MonoChip>{t('settings.integrations.apiKeys.revoked')}</MonoChip>
                  ) : (
                    <MonoChip tone={k.environment === 'live' ? 'success' : 'info'}>{t(`settings.integrations.apiKeys.env.${k.environment}`)}</MonoChip>
                  )
                }
                actions={
                  <ActionsMenu
                    label={t('action.actions')}
                    actions={toMenuActions(k.actions, { revoke: { label: t('action.revoke'), destructive: true, onSelect: () => (setRevokeError(null), setToRevoke(k)) } }, t)}
                  />
                }
              />
            ))}
          </ul>
        )}
        <p className="ts-label-meta text-text-muted">{t('settings.integrations.apiKeys.usage')}</p>
      </IntegrationCard>

      <CreateApiKeyDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => void qc.invalidateQueries({ queryKey: integrationKeys.apiKeys(ws) })}
      />
      <ConfirmDialog
        open={!!toRevoke}
        onOpenChange={(o) => !o && setToRevoke(null)}
        title={t('settings.integrations.apiKeys.revokeTitle', { name: toRevoke?.name ?? '' })}
        description={t('settings.integrations.apiKeys.revokeText')}
        confirmLabel={t('action.revoke')}
        cancelLabel={t('action.cancel')}
        closeLabel={t('action.close')}
        destructive
        loading={revoke.isPending}
        onConfirm={async () => {
          if (!toRevoke) return;
          setRevokeError(null);
          try {
            await revoke.mutateAsync(toRevoke.id);
            await qc.invalidateQueries({ queryKey: integrationKeys.apiKeys(ws) });
            toast(t('settings.integrations.apiKeys.revokedToast', { name: toRevoke.name }));
            setToRevoke(null);
          } catch (e) {
            setRevokeError(errorMessage(e, t));
            void qc.invalidateQueries({ queryKey: integrationKeys.apiKeys(ws) });
          }
        }}
      >
        {revokeError ? <FormAlert>{revokeError}</FormAlert> : null}
      </ConfirmDialog>
    </>
  );
}

type FormValues = { name: string; scopes: ApiScope[]; environment: 'live' | 'test' };

function CreateApiKeyDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const form = useForm<FormValues>({ resolver: zodResolver(CreateApiKeySchema) as never, defaultValues: { name: '', scopes: [], environment: 'live' } });
  const [created, setCreated] = useState<ApiKeyCreatedDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useMutation({ mutationFn: (v: CreateApiKeyInput) => integrationsApi.createApiKey(v) });
  const { reset } = form;
  useEffect(() => {
    if (open) {
      reset({ name: '', scopes: [], environment: 'live' });
      setCreated(null);
      setFormError(null);
    }
  }, [open, reset]);
  const { guard } = useLeaveGuard(open && !created && form.formState.isDirty, t('settings.integrations.apiKeys.dialogTitle'));

  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const key = await save.mutateAsync(v);
      setCreated(key);
      onCreated();
    } catch (e) {
      setFormError(applyServerErrors(form, e, t, { fields: ['name', 'scopes', 'environment'] }));
      onCreated();
    }
  });
  const busy = save.isPending;
  const errors = form.formState.errors;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={t('settings.integrations.apiKeys.dialogTitle')}
      description={t('settings.integrations.apiKeys.dialogContext')}
      closeLabel={t('action.close')}
      size="lg"
      footer={
        created ? (
          <Button variant="primary" onClick={onClose} data-testid="api-key-done">
            {t('action.close')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t('action.close')}
            </Button>
            <Button variant="primary" type="submit" form="api-key-form" loading={busy} data-testid="api-key-submit">
              {t('settings.integrations.apiKeys.submit')}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-3" data-testid="api-key-created">
          <p className="text-[13px] text-text-secondary">{t('settings.integrations.apiKeys.createdText', { name: created.name })}</p>
          <SecretOnce
            value={created.key}
            note={t('settings.integrations.apiKeys.onceNote')}
            copyLabel={t('action.copy')}
            copiedLabel={t('toast.copied')}
            onCopied={() => toast(t('toast.copied'))}
            testId="api-key-secret"
          />
          <p className="ts-label-meta text-text-muted">{t('settings.integrations.apiKeys.headerHint')}</p>
        </div>
      ) : (
        <form id="api-key-form" onSubmit={submit} noValidate className="flex flex-col gap-4" aria-busy={busy}>
          <Field label={t('settings.integrations.apiKeys.field.name')} htmlFor="api-key-name" required error={fieldError(t, errors.name?.message, { max: 80 })}>
            <Input id="api-key-name" maxLength={80} dir="auto" placeholder={t('settings.integrations.apiKeys.field.namePlaceholder')} disabled={busy} aria-invalid={!!errors.name} data-testid="api-key-name" {...form.register('name')} />
          </Field>
          <Field label={t('settings.integrations.apiKeys.field.environment')}>
            <Controller
              control={form.control}
              name="environment"
              render={({ field }) => (
                <SegmentedControl
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  options={[
                    { value: 'live', label: t('settings.integrations.apiKeys.env.live') },
                    { value: 'test', label: t('settings.integrations.apiKeys.env.test') },
                  ]}
                  label={t('settings.integrations.apiKeys.field.environment')}
                />
              )}
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="ts-label-meta mb-1.5 uppercase text-text-secondary">
              {t('settings.integrations.apiKeys.field.scopes')}
              <span className="text-accent-alert"> *</span>
            </legend>
            <Controller
              control={form.control}
              name="scopes"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2" data-testid="api-key-scopes">
                  {API_SCOPES.map((s) => (
                    <CheckChip key={s} name={s} checked={field.value.includes(s)} disabled={busy} onChange={(on) => field.onChange(on ? [...field.value, s] : field.value.filter((x) => x !== s))}>
                      <span dir="ltr" className="font-mono text-[12px]">
                        {s}
                      </span>
                    </CheckChip>
                  ))}
                </div>
              )}
            />
            {errors.scopes ? (
              <p role="alert" className="text-[12px] text-accent-alert">
                {t('settings.integrations.apiKeys.field.scopesRequired')}
              </p>
            ) : (
              <p className="text-[12px] text-text-muted">{t('settings.integrations.apiKeys.field.scopesHint')}</p>
            )}
          </fieldset>
          {formError ? <FormAlert>{formError}</FormAlert> : null}
        </form>
      )}
      {guard}
    </Dialog>
  );
}
