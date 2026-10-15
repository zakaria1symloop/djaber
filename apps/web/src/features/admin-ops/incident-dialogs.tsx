'use client';
// Incidents of ADM-14 (OPS-05): "Déclarer un incident" (title FR/AR/EN, severity, components of the public status page,
// optional message, affected workspaces, incident banner) and the incident dialog (updates timeline, new update,
// resolution with post-mortem). Not drawn in the DLG catalogue: built on its pattern (assumptions-log M10 web-b).
import { formatDateTime, STATUS_COMPONENTS, type IncidentCreateInput, type IncidentDto, type OpsLocalizedText } from '@djaber/shared';
import { Button, Checkbox, Dialog, Field, FormAlert, NumberInput, OrderTimeline, Select, StatePill, Textarea, toast } from '@djaber/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useCloseGuard, useTypedFlag } from '@/components/close-guard';
import { DialogFooter, RadioList, useDialogSubmit, useOnOpen } from '@/features/orders/dialogs/common';
import { useLocaleCode, useT } from '@/lib/i18n';
import { opsApi, opsKeys, useIncidents } from './api';
import { cleanLocalized, EMPTY_LOCALIZED, LocalizedFields, useLocalized, userName, useWrite } from './common';

const SEVERITIES = ['minor', 'major', 'critical'] as const;
const UPDATE_STATUSES = ['open', 'identified', 'monitoring'] as const;

export function DeclareIncidentDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (i: IncidentDto) => void }) {
  const typed = useTypedFlag(open);
  const t = useT();
  const qc = useQueryClient();
  const [title, setTitle] = useState<OpsLocalizedText>(EMPTY_LOCALIZED);
  const [body, setBody] = useState<OpsLocalizedText>(EMPTY_LOCALIZED);
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('minor');
  const [components, setComponents] = useState<string[]>([]);
  const [affected, setAffected] = useState<number | null>(null);
  const [banner, setBanner] = useState(false);
  const [titleError, setTitleError] = useState<string | undefined>();
  const s = useDialogSubmit(async () => {
    const input: IncidentCreateInput = {
      title: cleanLocalized(title),
      severity,
      status: 'open',
      components,
      ...(body.fr.trim() ? { body: cleanLocalized(body) } : {}),
      affectedWorkspaces: affected,
      banner,
    };
    return opsApi.createIncident(input);
  });
  useOnOpen(open, () => {
    setTitle(EMPTY_LOCALIZED);
    setBody(EMPTY_LOCALIZED);
    setSeverity('minor');
    setComponents([]);
    setAffected(null);
    setBanner(false);
    setTitleError(undefined);
    s.setError(null);
  });
  const submit = async () => {
    if (!title.fr.trim()) {
      setTitleError(t('validation.required'));
      return;
    }
    setTitleError(undefined);
    const r = await s.submit();
    if (!r) return;
    toast({ tone: 'success', message: t('adminHealth.incident.declared') });
    await Promise.all([qc.invalidateQueries({ queryKey: opsKeys.incidents }), qc.invalidateQueries({ queryKey: opsKeys.health })]);
    onClose();
    onDone(r);
  };
  const toggle = (c: string) => setComponents((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const guard = useCloseGuard(typed.dirty, t('adminHealth.incident.declare'), onClose);
  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(o) => !o && guard.requestClose()}
      title={t('adminHealth.incident.declare')}
      description={t('adminHealth.incident.declare.sub')}
      closeLabel={t('action.close')}
      size="lg"
      footer={<DialogFooter onClose={guard.requestClose} busy={s.busy} onSubmit={() => void submit()} label={t('adminHealth.incident.declare.submit')} danger />}
    >
      <div onChange={typed.onChange} className="flex flex-col gap-4" data-testid="incident-form">
        <LocalizedFields idPrefix="incident-title" label={t('adminHealth.incident.field.title')} value={title} onChange={setTitle} required error={titleError ?? s.fieldError('title.fr')} />
        <div>
          <div className="mb-1.5 ts-label-micro uppercase text-text-muted">{t('adminHealth.incident.field.severity')}</div>
          <RadioList label={t('adminHealth.incident.field.severity')} value={severity} onChange={setSeverity} options={SEVERITIES.map((v) => ({ value: v, label: t(`adminHealth.severity.${v}`) }))} />
        </div>
        <fieldset>
          <legend className="mb-1.5 ts-label-micro uppercase text-text-muted">{t('adminHealth.incident.field.components')}</legend>
          <div className="flex flex-wrap gap-2">
            {STATUS_COMPONENTS.map((c) => (
              <label key={c} className="inline-flex cursor-pointer items-center gap-2 rounded-card border border-line-edge px-2.5 py-1.5 text-[13px]">
                <Checkbox checked={components.includes(c)} onChange={() => toggle(c)} />
                {t(`adminHealth.component.${c}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <LocalizedFields idPrefix="incident-body" label={t('adminHealth.incident.field.body')} value={body} onChange={setBody} multiline />
        <Field label={t('adminHealth.incident.field.affected')} htmlFor="incident-affected">
          <NumberInput id="incident-affected" value={affected === null ? '' : String(affected)} onValueChange={(v) => setAffected(v === '' ? null : Number(v))} />
        </Field>
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
          <Checkbox checked={banner} onChange={(e) => setBanner(e.target.checked)} className="mt-0.5" data-testid="incident-banner" />
          <span>{t('adminHealth.incident.field.banner')}</span>
        </label>
        {s.error ? <FormAlert>{s.error}</FormAlert> : null}
      </div>
    </Dialog>
    {guard.element}
    </>
  );
}

export function IncidentDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useT();
  const locale = useLocaleCode() as 'fr' | 'ar' | 'en';
  const qc = useQueryClient();
  const pick = useLocalized();
  const incidents = useIncidents();
  const write = useWrite('admin.health.write');
  const incident = incidents.data?.rows.find((i) => i.id === id) ?? null;
  const [status, setStatus] = useState<(typeof UPDATE_STATUSES)[number]>('identified');
  const [body, setBody] = useState<OpsLocalizedText>(EMPTY_LOCALIZED);
  const [postMortem, setPostMortem] = useState('');
  const [mode, setMode] = useState<'update' | 'resolve'>('update');
  const [bodyError, setBodyError] = useState<string | undefined>();
  const update = useDialogSubmit(() => opsApi.incidentUpdate(id ?? '', { status, body: cleanLocalized(body) }));
  const resolve = useDialogSubmit(() => opsApi.resolveIncident(id ?? '', postMortem.trim() ? { postMortem: postMortem.trim() } : {}));
  useOnOpen(!!id, () => {
    setStatus('identified');
    setBody(EMPTY_LOCALIZED);
    setPostMortem('');
    setMode('update');
    setBodyError(undefined);
    update.setError(null);
    resolve.setError(null);
  });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: opsKeys.incidents }), qc.invalidateQueries({ queryKey: opsKeys.health })]);
  const sendUpdate = async () => {
    if (!body.fr.trim()) {
      setBodyError(t('validation.required'));
      return;
    }
    setBodyError(undefined);
    if (await update.submit()) {
      toast({ tone: 'success', message: t('adminHealth.incident.updated') });
      setBody(EMPTY_LOCALIZED);
      await refresh();
    }
  };
  const sendResolve = async () => {
    if (await resolve.submit()) {
      toast({ tone: 'success', message: t('adminHealth.incident.resolvedToast') });
      await refresh();
      onClose();
    }
  };
  const open = incident ? incident.status !== 'resolved' : false;
  const busy = update.busy || resolve.busy;
  return (
    <Dialog
      open={!!id}
      onOpenChange={(o) => !o && onClose()}
      title={incident ? pick(incident.title) : t('adminHealth.incidents.title')}
      description={incident ? [t(`adminHealth.severity.${incident.severity}`), incident.components.map((c) => (t.has(`adminHealth.component.${c}`) ? t(`adminHealth.component.${c}`) : c)).join(', ')].filter(Boolean).join(' · ') : undefined}
      closeLabel={t('action.close')}
      size="lg"
      footer={
        write.allowed && open ? (
          mode === 'update' ? (
            <>
              <Button variant="ghost" onClick={() => setMode('resolve')} disabled={busy} data-testid="incident-resolve-start">
                {t('adminHealth.incident.resolve')}
              </Button>
              <Button variant="primary" onClick={() => void sendUpdate()} loading={update.busy} disabledReason={write.disabledReason} data-testid="incident-update-submit">
                {t('adminHealth.incident.update.submit')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setMode('update')} disabled={busy}>
                {t('action.back')}
              </Button>
              <Button variant="primary" onClick={() => void sendResolve()} loading={resolve.busy} disabledReason={write.disabledReason} data-testid="incident-resolve-submit">
                {t('adminHealth.incident.resolve')}
              </Button>
            </>
          )
        ) : (
          <Button variant="ghost" onClick={onClose}>
            {t('action.close')}
          </Button>
        )
      }
    >
      {!incident ? (
        <p className="text-[13px] text-text-muted">{incidents.isPending ? t('common.loading') : t('admin.state.notFound')}</p>
      ) : (
        <div className="flex flex-col gap-4" data-testid="incident-detail" data-status={incident.status}>
          <div className="flex flex-wrap items-center gap-2">
            <StatePill state={open ? 'incident' : 'ok'}>{t(`adminHealth.incidentStatus.${incident.status}`)}</StatePill>
            <span className="ts-label-meta text-text-muted">
              {formatDateTime(incident.startedAt, locale)}
              {incident.resolvedAt ? ` → ${formatDateTime(incident.resolvedAt, locale)}` : ''}
              {incident.durationMinutes !== null ? ` · ${t('adminHealth.incident.duration', { minutes: incident.durationMinutes })}` : ''}
            </span>
          </div>
          <OrderTimeline
            label={t('adminHealth.incident.updates')}
            empty={t('adminHealth.incident.noUpdates')}
            items={incident.updates.map((u) => ({ key: u.id, time: formatDateTime(u.at, locale), title: t(`adminHealth.incidentStatus.${u.status}`), text: pick(u.body), meta: userName(u.author), tone: u.status === 'resolved' ? ('success' as const) : ('warning' as const) }))}
          />
          {incident.postMortem ? (
            <div>
              <div className="mb-1 ts-label-micro uppercase text-text-muted">{t('adminHealth.incident.field.postMortem')}</div>
              <p className="whitespace-pre-wrap text-[13px] text-text-secondary">{incident.postMortem}</p>
            </div>
          ) : null}
          {write.allowed && open && mode === 'update' ? (
            <div className="flex flex-col gap-3 border-t border-line-hairline pt-4">
              <Field label={t('adminHealth.incident.field.status')} htmlFor="incident-status">
                <Select id="incident-status" value={status} onChange={(e) => setStatus(e.target.value as (typeof UPDATE_STATUSES)[number])}>
                  {UPDATE_STATUSES.map((v) => (
                    <option key={v} value={v}>
                      {t(`adminHealth.incidentStatus.${v}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <LocalizedFields idPrefix="incident-update" label={t('adminHealth.incident.field.update')} value={body} onChange={setBody} multiline required error={bodyError} />
              {update.error ? <FormAlert>{update.error}</FormAlert> : null}
            </div>
          ) : null}
          {write.allowed && open && mode === 'resolve' ? (
            <div className="flex flex-col gap-3 border-t border-line-hairline pt-4">
              <Field label={t('adminHealth.incident.field.postMortem')} htmlFor="incident-pm" hint={t('adminHealth.incident.postMortem.hint')}>
                <Textarea id="incident-pm" rows={5} value={postMortem} onChange={(e) => setPostMortem(e.target.value)} />
              </Field>
              {resolve.error ? <FormAlert>{resolve.error}</FormAlert> : null}
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
