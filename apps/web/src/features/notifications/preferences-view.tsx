'use client';
// /settings/notifications — Figma "SET — Settings — Quick replies · System messages · Notifications · Stock mode ·
// Danger zone" › "Préférences de notifications (vous)" (NTF-02, 12 §13 / §18): table ÉVÉNEMENT × IN-APP / E-MAIL /
// PUSH / SON per family, saved on every toggle (optimistic, rolled back on error), plus the sound on a new customer
// message of the inbox (`User.prefs.soundOnMessage`).
import type { NotificationPreferenceView } from '@djaber/shared';
import { Checkbox, ListSkeleton, Switch, Table, Td, Th, toast, Tr } from '@djaber/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { QueryError } from '@/components/global-states';
import { Section, SettingsPage } from '@/features/settings/common';
import type { MeDto } from '@/lib/contracts';
import { errorMessage } from '@/lib/forms';
import { useT } from '@/lib/i18n';
import { meKey, useSession, useWorkspaceId } from '@/lib/session';
import { preferencesApi, preferencesKey, prefsOf, usePreferences } from './preferences-api';
import { applyPatch, familyCell, familyPatch, PREF_FAMILIES, type PrefChannel } from './preferences';

const CHANNELS: PrefChannel[] = ['email', 'push', 'sound'];
/** No web push and the mobile apps are not published yet ("bientôt disponible"): the PUSH column is shown greyed with its reason. */
const PUSH_AVAILABLE = false;

export function NotificationPreferencesView() {
  const t = useT();
  return (
    <SettingsPage title={t('nav.settings.notifications')} description={t('notifPrefs.description')} permission="notifications.own">
      <SoundSection />
      <Section title={t('notifPrefs.title')} description={t('notifPrefs.subtitle')}>
        <PreferencesTable />
      </Section>
    </SettingsPage>
  );
}

function SoundSection() {
  const t = useT();
  const qc = useQueryClient();
  const { me } = useSession();
  const [saving, setSaving] = useState(false);
  const on = me?.prefs?.soundOnMessage === true;
  const toggle = async (value: boolean) => {
    if (!me) return;
    const before = me.prefs;
    qc.setQueryData<MeDto>(meKey, (old) => (old ? { ...old, prefs: { ...old.prefs, soundOnMessage: value } } : old));
    setSaving(true);
    try {
      const r = prefsOf(await preferencesApi.patchMyPrefs({ soundOnMessage: value }));
      if (r) qc.setQueryData<MeDto>(meKey, (old) => (old ? { ...old, prefs: { ...old.prefs, ...r } } : old));
      toast(t('toast.saved'));
    } catch (e) {
      qc.setQueryData<MeDto>(meKey, (old) => (old ? { ...old, prefs: before } : old));
      toast({ tone: 'danger', message: errorMessage(e, t) });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Section>
      <div className="flex items-center gap-4" data-testid="sound-on-message">
        <Switch checked={on} onCheckedChange={(v) => void toggle(v)} label={t('notifPrefs.soundOnMessage')} disabled={!me || saving} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px]">{t('notifPrefs.soundOnMessage')}</div>
          <div className="ts-label-meta text-text-muted">{t('notifPrefs.soundOnMessage.hint')}</div>
        </div>
      </div>
    </Section>
  );
}

function PreferencesTable() {
  const t = useT();
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  const q = usePreferences();
  const [busy, setBusy] = useState<string | null>(null);

  if (q.isPending) return <ListSkeleton rows={5} columns={5} label={t('common.loading')} />;
  if (q.isError) return <QueryError error={q.error} onRetry={() => void q.refetch()} />;
  const prefs = q.data;

  const change = async (group: (typeof PREF_FAMILIES)[number]['group'], channel: PrefChannel, value: boolean) => {
    const patch = familyPatch(prefs, group, channel, value);
    if (!patch.length) return;
    const key = preferencesKey(ws);
    const before = qc.getQueryData<NotificationPreferenceView[]>(key);
    qc.setQueryData<NotificationPreferenceView[]>(key, (old) => (old ? applyPatch(old, patch) : old));
    setBusy(`${group}:${channel}`);
    try {
      const r = await preferencesApi.update(patch);
      if (Array.isArray(r) && r.length) qc.setQueryData(key, r);
      toast(t('notifPrefs.saved'));
    } catch (e) {
      qc.setQueryData(key, before);
      toast({ tone: 'danger', message: errorMessage(e, t) });
    } finally {
      setBusy(null);
    }
  };

  const pushReason = PUSH_AVAILABLE ? undefined : t('notifPrefs.pushSoon');
  return (
    <>
    <Table aria-label={t('notifPrefs.title')} data-testid="notification-preferences">
      <thead>
        <tr>
          <Th>{t('notifPrefs.col.event')}</Th>
          <Th className="w-20 text-center">{t('notifPrefs.col.inApp')}</Th>
          <Th className="w-20 text-center">{t('notifPrefs.col.email')}</Th>
          <Th className="w-20 text-center" title={pushReason}>
            {t('notifPrefs.col.push')}
            {pushReason ? <span aria-hidden> *</span> : null}
          </Th>
          <Th className="w-20 text-center">{t('notifPrefs.col.sound')}</Th>
        </tr>
      </thead>
      <tbody>
        {PREF_FAMILIES.map((f) => {
          const label = t(f.labelKey);
          return (
            <Tr key={f.group} data-family={f.group}>
              <Td className="text-[13px]">{label}</Td>
              <Td className="text-center">
                <Checkbox checked disabled aria-label={`${label} — ${t('notifPrefs.col.inApp')} (${t('notifPrefs.always')})`} className="inline-block" />
              </Td>
              {CHANNELS.map((channel) => {
                const cell = familyCell(prefs, f.group, channel);
                const name = `${label} — ${t(`notifPrefs.col.${channel}`)}`;
                const off = channel === 'push' ? pushReason : undefined;
                return (
                  <Td key={channel} className="text-center" data-channel={channel} data-locked={cell.locked ?? undefined} data-mixed={cell.mixed || undefined}>
                    {cell.locked === 'never' ? (
                      <span className="text-text-muted" title={t('notifPrefs.never')} aria-label={`${name} : ${t('notifPrefs.never')}`}>
                        —
                      </span>
                    ) : (
                      <span className="inline-flex flex-col items-center gap-0.5" title={off ?? (cell.locked === 'always' ? t('notifPrefs.always') : undefined)}>
                        <Switch checked={cell.value} onCheckedChange={(v) => void change(f.group, channel, v)} label={off ? `${name} (${off})` : name} disabled={!!off || cell.locked === 'always' || busy === `${f.group}:${channel}`} />
                        {cell.mixed ? <span className="ts-label-micro text-text-muted">{t('notifPrefs.mixed')}</span> : null}
                      </span>
                    )}
                  </Td>
                );
              })}
            </Tr>
          );
        })}
      </tbody>
    </Table>
    {pushReason ? (
      <p className="ts-label-meta mt-2 !normal-case text-text-muted" data-testid="push-soon">
        {`* ${pushReason}`}
      </p>
    ) : null}
    </>
  );
}
