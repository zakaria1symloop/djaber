import { describe, expect, it } from 'vitest';
import type { TFunction } from '@/lib/i18n';
import { versionNote } from './version-note';

const t = ((key: string, p?: Record<string, unknown>) => `<${key}${p ? ` ${JSON.stringify(p)}` : ''}>`) as unknown as TFunction;

describe('version note in words', () => {
  it('codes written by the API get their label', () => {
    expect(versionNote(t, { note: 'activation', source: 'wizard' })).toBe('<agents.versions.note.activation>');
    expect(versionNote(t, { note: 'preset:vendeur-pro', source: 'wizard' }, { key: 'vendeur-pro', name: 'Vendeur Pro' })).toBe('<agents.versions.note.preset {"name":"Vendeur Pro"}>');
    expect(versionNote(t, { note: 'preset:autre', source: 'wizard' }, { key: 'vendeur-pro', name: 'Vendeur Pro' })).toBe('<agents.versions.note.preset {"name":"autre"}>');
    expect(versionNote(t, { note: 'preset v8', source: 'preset_update' })).toBe('<agents.versions.note.presetUpdate {"version":"8"}>');
    expect(versionNote(t, { note: 'duplicate:01a1', source: 'manual' })).toBe('<agents.versions.note.duplicate>');
    expect(versionNote(t, { note: 'insight:01a1', source: 'insight' })).toBe('<agents.versions.source.insight>');
  });
  it('a merchant note stays as written; no note ⇒ the source label', () => {
    expect(versionNote(t, { note: 'Ajout règle « mot-clé arnaque »', source: 'manual' })).toBe('Ajout règle « mot-clé arnaque »');
    expect(versionNote(t, { note: null, source: 'restore' })).toBe('<agents.versions.source.restore>');
    expect(versionNote(t, { note: null, source: 'weird' })).toBe('weird');
  });
});
