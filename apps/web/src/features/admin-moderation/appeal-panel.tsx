'use client';
// ADM-10 "Appels du marchand" (03 MOD-05): the rejected decision, the merchant's message and attachment (image or PDF,
// ≤ 5 MB), and the final decision of a second moderator (`upheld` = refus maintenu / `overturned` = refus annulé)
// with a note. A reviewer who took the first decision gets the server reason (FORBIDDEN) on the greyed buttons.
import { formatDateTime, type AppLocale, type ModerationAppealDto } from '@djaber/shared';
import { Button, DecisionChip, FlaggedField, FormAlert, ModerationRow, Pill, Textarea, toast } from '@djaber/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { actionState } from '@/lib/actions';
import { errorMessage, useLeaveGuard } from '@/lib/forms';
import { useLocaleCode, useT } from '@/lib/i18n';
import { modApi, useModerationRefresh } from './api';
import { decisionLabel } from './ui';

export function AppealRow({ appeal, active, onOpen }: { appeal: ModerationAppealDto; active: boolean; onOpen: () => void }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  return (
    <ModerationRow
      data-testid="appeal-row"
      data-id={appeal.id}
      active={active}
      title={appeal.item.productName ?? t(`adminMod.type.${appeal.item.type}`)}
      urgentLabel={appeal.overdue ? t('enum.Admin.urgent') : undefined}
      meta={`${appeal.workspace.name} · ${t('adminMod.appeal.submitted', { date: formatDateTime(appeal.submittedAt, locale) })}`}
      reason={appeal.message}
      onOpen={onOpen}
    />
  );
}

export function AppealPanel({ appeal, canWrite }: { appeal: ModerationAppealDto; canWrite: boolean }) {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const refresh = useModerationRefresh();
  const [decision, setDecision] = useState<'upheld' | 'overturned' | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const decided = !!appeal.decision;
  const { guard } = useLeaveGuard(!decided && note.trim().length > 0, appeal.item.productName ?? '');
  // descriptors `uphold` / `overturn` (greyed FORBIDDEN for the moderator who took the first decision)
  const stateOf = (d: 'upheld' | 'overturned') => actionState(appeal.actions, d === 'upheld' ? 'uphold' : 'overturn', t);
  const offOf = (d: 'upheld' | 'overturned') => !canWrite || (stateOf(d).present && !stateOf(d).enabled);
  const allowed = canWrite && !(offOf('upheld') && offOf('overturned'));
  const blocked = decision ? (stateOf(decision).present && !stateOf(decision).enabled ? stateOf(decision).reason : undefined) : offOf('upheld') && offOf('overturned') ? stateOf('upheld').reason : undefined;
  const send = useMutation({ mutationFn: () => modApi.decideAppeal(appeal.id, { decision: decision!, note: note.trim() }) });
  const submit = async () => {
    setError(null);
    if (!decision) return setError(t('adminMod.appeal.choose'));
    try {
      await send.mutateAsync();
      toast({ tone: 'success', message: t(`adminMod.appeal.toast.${decision}`) });
      setNote('');
      void refresh();
    } catch (e) {
      setError(errorMessage(e, t));
      if (e instanceof ApiError && e.status === 409) void refresh();
    }
  };
  const reviewer = appeal.item.reviewer ? `${appeal.item.reviewer.firstName} ${appeal.item.reviewer.lastName}`.trim() : '—';
  return (
    <section data-testid="appeal-panel" data-id={appeal.id} className="rounded-card border border-line-edge bg-ink-surface p-4 md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="ts-display-s min-w-0 flex-1">{appeal.item.productName ?? t(`adminMod.type.${appeal.item.type}`)}</h2>
        <Pill tone={decided ? (appeal.decision === 'overturned' ? 'success' : 'danger') : 'violet'}>{decided ? t(`adminMod.appeal.decision.${appeal.decision}`) : t('enum.Admin.appeal')}</Pill>
      </header>
      <p className="mt-2 ts-label-micro text-text-muted">
        {[appeal.workspace.name, t('adminMod.appeal.deadline', { date: formatDateTime(appeal.deadlineAt, locale) })].join(' · ')}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <FlaggedField label={t('adminMod.appeal.rejection')} flagged>
          {[decisionLabel(t, appeal.item.decision), reviewer, appeal.item.decidedAt ? formatDateTime(appeal.item.decidedAt, locale) : null].filter(Boolean).join(' · ')}
          {appeal.item.merchantMessage ? <span className="mt-1 block text-[13px] text-text-secondary">« {appeal.item.merchantMessage} »</span> : null}
        </FlaggedField>
        <FlaggedField label={t('adminMod.appeal.message')}>{appeal.message}</FlaggedField>
        <FlaggedField label={t('adminMod.appeal.attachment')}>
          {appeal.attachmentUrl ? (
            <a href={appeal.attachmentUrl} target="_blank" rel="noreferrer" className="text-accent-inbound hover:underline" data-testid="appeal-attachment">
              {t(appeal.attachmentMime === 'application/pdf' ? 'adminMod.appeal.attachmentPdf' : 'adminMod.appeal.attachmentImage')}
            </a>
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </FlaggedField>
      </div>
      {decided ? (
        <p className="mt-5 text-[13px] text-text-secondary" data-testid="appeal-decided">
          {[t(`adminMod.appeal.decision.${appeal.decision}`), appeal.decidedAt ? formatDateTime(appeal.decidedAt, locale) : null, appeal.reviewer ? `${appeal.reviewer.firstName} ${appeal.reviewer.lastName}`.trim() : null].filter(Boolean).join(' · ')}
          {appeal.decisionNote ? <span className="mt-1 block">« {appeal.decisionNote} »</span> : null}
        </p>
      ) : (
        <div className="mt-5">
          <div className="ts-label-micro uppercase text-text-muted">{t('adminMod.panel.decision')}</div>
          <div role="radiogroup" aria-label={t('adminMod.panel.decision')} className="mt-2 flex flex-wrap gap-2">
            {(['upheld', 'overturned'] as const).map((d) => (
              <DecisionChip key={d} name={`appeal-${appeal.id}`} value={d} checked={decision === d} onChange={() => setDecision(d)} disabled={offOf(d)}>
                {t(`adminMod.appeal.choice.${d}`)}
              </DecisionChip>
            ))}
          </div>
          <Textarea className="mt-3 min-h-20 py-2.5" aria-label={t('adminMod.appeal.note')} placeholder={t('adminMod.appeal.note')} value={note} onChange={(e) => setNote(e.target.value)} disabled={!allowed} maxLength={1000} data-testid="appeal-note" />
          {error ? <FormAlert className="mt-3">{error}</FormAlert> : null}
          {canWrite ? (
            <div className="mt-4 flex justify-end">
              <Button variant="primary" onClick={() => void submit()} loading={send.isPending} disabledReason={blocked} data-testid="appeal-submit">
                {t('adminMod.appeal.submit')}
              </Button>
            </div>
          ) : (
            <p className="mt-3 ts-label-meta text-text-muted">{t('adminMod.panel.readOnly')}</p>
          )}
          <p className="mt-4 ts-label-micro text-text-muted">{t('adminMod.appeal.rule')}</p>
        </div>
      )}
      {guard}
    </section>
  );
}
