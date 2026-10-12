// `AgentVersion.note` is either the merchant's own note (Configuration save) or a code written by the API:
// `activation`, `preset:<key>` (draft created from a preset), `preset v<n>` (preset update applied), `duplicate:<id>`,
// `insight:<id>`. The versions list of AGT-03 shows the codes in words ("Création depuis Vendeur Pro (préréglage)").
import type { TFunction } from '@/lib/i18n';

const SOURCES = ['manual', 'wizard', 'insight', 'preset_update', 'restore', 'generation'];

export const versionNote = (t: TFunction, v: { note: string | null; source: string }, preset?: { key: string; name: string } | null): string => {
  const note = v.note?.trim();
  if (!note) return SOURCES.includes(v.source) ? t(`agents.versions.source.${v.source}`) : v.source;
  if (note === 'activation') return t('agents.versions.note.activation');
  const fromPreset = /^preset:(.+)$/.exec(note);
  if (fromPreset) return t('agents.versions.note.preset', { name: preset && preset.key === fromPreset[1] ? preset.name : fromPreset[1]! });
  const presetUpdate = /^preset v(\d+)$/.exec(note);
  if (presetUpdate) return t('agents.versions.note.presetUpdate', { version: presetUpdate[1]! });
  if (/^duplicate:/.test(note)) return t('agents.versions.note.duplicate');
  if (/^insight:/.test(note)) return t('agents.versions.source.insight');
  return note;
};
