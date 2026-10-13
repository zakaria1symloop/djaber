'use client';
// Review step of "Générer un agent depuis ma page" (AGT-03, M11 carry-over): the proposed instructions, FAQ rows and
// shop policies are editable before applying; the edited fields go to `POST /agents/generate/:jobId/apply { override }`.
import { Button, Field, IconButton, Input, Textarea } from '@djaber/ui';
import { AGENT_POLICY_MAX, formatNumber } from '@djaber/shared';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useT } from '@/lib/i18n';
import { POLICY_KEYS, type GenerationResult } from './contracts';
import { reviewOverride, seedReview, type Review } from './generate-review-logic';

export { reviewOverride, seedReview, type Review };

const INSTRUCTIONS_MAX = 10_000;

export function ReviewEditor({ result, value, onChange, disabled }: { result: GenerationResult; value: Review | null; onChange: (r: Review) => void; disabled?: boolean }) {
  const t = useT();
  // seeded from the proposal whenever the parent has no review yet (new job ⇒ the parent resets it to null)
  const empty = value === null;
  useEffect(() => {
    if (empty) onChange(seedReview(result));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seeded when empty only
  }, [empty]);
  if (!value) return null;
  const edited = reviewOverride(result, value) !== undefined;
  const setFaq = (i: number, patch: Partial<{ q: string; a: string }>) => onChange({ ...value, faq: value.faq.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className="flex flex-col gap-4" data-testid="generate-review-editor" data-edited={edited ? 'true' : 'false'}>
      <Field
        label={t('agents.generate.instructions')}
        htmlFor="generate-instructions-edit"
        hint={t('carry.generate.instructions.count', { count: formatNumber(value.instructions.length), max: formatNumber(INSTRUCTIONS_MAX) })}
      >
        <Textarea
          id="generate-instructions-edit"
          rows={8}
          dir="auto"
          maxLength={INSTRUCTIONS_MAX}
          disabled={disabled}
          value={value.instructions}
          onChange={(e) => onChange({ ...value, instructions: e.target.value })}
          data-testid="generate-instructions"
        />
      </Field>

      <div>
        <div className="ts-label-micro text-text-muted">{t('carry.generate.faq')}</div>
        <ul className="mt-1.5 flex flex-col gap-2" data-testid="generate-faq">
          {value.faq.map((r, i) => (
            <li key={i} className="flex items-start gap-2 rounded-card border border-line-hairline bg-ink-base p-2.5" data-testid="generate-faq-row">
              <div className="grid min-w-0 flex-1 gap-2">
                <Input
                  dir="auto"
                  maxLength={500}
                  disabled={disabled}
                  value={r.q}
                  aria-label={t('carry.generate.faq.question', { n: i + 1 })}
                  placeholder={t('carry.generate.faq.questionPlaceholder')}
                  onChange={(e) => setFaq(i, { q: e.target.value })}
                />
                <Textarea
                  dir="auto"
                  rows={2}
                  maxLength={2000}
                  disabled={disabled}
                  value={r.a}
                  aria-label={t('carry.generate.faq.answer', { n: i + 1 })}
                  placeholder={t('carry.generate.faq.answerPlaceholder')}
                  onChange={(e) => setFaq(i, { a: e.target.value })}
                />
              </div>
              <IconButton
                label={t('carry.generate.faq.remove', { n: i + 1 })}
                disabled={disabled}
                onClick={() => onChange({ ...value, faq: value.faq.filter((_, j) => j !== i) })}
                data-testid="generate-faq-remove"
              >
                <X className="size-4" aria-hidden />
              </IconButton>
            </li>
          ))}
          {value.faq.length === 0 ? <li className="text-[13px] text-text-muted">{t('carry.generate.faq.none')}</li> : null}
        </ul>
        <Button className="mt-2" size="sm" variant="ghost" disabled={disabled || value.faq.length >= 100} onClick={() => onChange({ ...value, faq: [...value.faq, { q: '', a: '' }] })} data-testid="generate-faq-add">
          {t('carry.generate.faq.add')}
        </Button>
      </div>

      <div>
        <div className="ts-label-micro text-text-muted">{t('carry.generate.policies')}</div>
        <div className="mt-1.5 grid gap-3 md:grid-cols-2">
          {POLICY_KEYS.map((k) => (
            <Field key={k} label={t(`agents.policies.${k}`)} htmlFor={`generate-policy-${k}`}>
              <Textarea
                id={`generate-policy-${k}`}
                rows={2}
                dir="auto"
                maxLength={AGENT_POLICY_MAX}
                disabled={disabled}
                value={value.policies[k] ?? ''}
                placeholder={t(`agents.policies.${k}.placeholder`)}
                onChange={(e) => onChange({ ...value, policies: { ...value.policies, [k]: e.target.value } })}
              />
            </Field>
          ))}
        </div>
      </div>

      {edited ? (
        <div className="flex flex-wrap items-center gap-2 ts-label-meta text-text-muted">
          <span data-testid="generate-review-edited">{t('carry.generate.edited')}</span>
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(seedReview(result))} data-testid="generate-review-reset">
            {t('carry.generate.reset')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
