'use client';
// Client tags field with suggestions from the workspace's existing tags (M11 carry-over M5: `GET /clients/tags?q=` →
// `{ tag, count }[]`, count desc). The typed text is debounced 250 ms before it reaches the query.
import { TagInput } from '@djaber/ui';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { useClientTags } from './api';
import { CLIENT_TAG_MAX_CHARS, CLIENT_TAGS_MAX } from './contracts';

export function ClientTagInput({ id, value, onChange, invalid }: { id?: string; value: string[]; onChange: (next: string[]) => void; invalid?: boolean }) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const h = window.setTimeout(() => setQ(draft), 250);
    return () => window.clearTimeout(h);
  }, [draft]);
  const tags = useClientTags(q);
  return (
    <TagInput
      id={id}
      value={value}
      onChange={onChange}
      label={t('common.tags')}
      placeholder={t('clients.dialog.tagsPlaceholder')}
      removeLabel={(x) => t('clients.dialog.removeTag', { tag: x })}
      max={CLIENT_TAGS_MAX}
      maxLength={CLIENT_TAG_MAX_CHARS}
      invalid={invalid}
      suggestions={tags.data ?? []}
      suggestionsLabel={t('carry.clients.tagSuggestions')}
      onDraftChange={setDraft}
    />
  );
}
