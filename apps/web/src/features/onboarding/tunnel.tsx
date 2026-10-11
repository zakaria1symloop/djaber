'use client';
// ONB-01 — Onboarding tunnel, steps 1–6 (Figma "ONB-01 — Onboarding — step 1…6"). Progress = Workspace.onboardingStep:
// leaving step n writes n + 1, "Passer la configuration" writes 99, so the next login resumes at the saved step.
// Steps 3–5 create entities of later milestones (products M2, channels M3, agents M4): they are drawn as designed and
// both of their buttons follow the "plus tard" path until those endpoints exist.
import { Button, buttonClass, Card, ChecklistRow, cn, Field, FormAlert, Input, OptionCard, Select, Skeleton, Steps, toast, type StepItem } from '@djaber/ui';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Bot, Box, Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { RESEND_COOLDOWN_S } from '@/components/auth/forgot-form';
import { QueryError } from '@/components/global-states';
import { authApi } from '@/features/auth/api';
import { useOnboarding, useOnboardingStep, usePatchWorkspace } from '@/features/workspace/api';
import { Link, useRouter } from '@/i18n/navigation';
import { checklistOf } from '@/lib/contracts';
import { formatClock, retryAfterSeconds, useCooldown } from '@/lib/countdown';
import { errorMessage } from '@/lib/forms';
import { ONBOARDING_STEPS, onboardingPath, stepNumber, type OnboardingSlug } from '@/lib/guards';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';

const STEP_LABEL: Record<OnboardingSlug, string> = {
  welcome: 'onboarding.step.welcome',
  'stock-mode': 'onboarding.step.stock',
  'first-product': 'onboarding.step.product',
  agent: 'onboarding.step.agent',
  connect: 'onboarding.step.page',
  ready: 'onboarding.step.ready',
};

function useAdvance(slug: OnboardingSlug) {
  const router = useRouter();
  const t = useT();
  const step = useOnboardingStep();
  const n = stepNumber(slug);
  const go = async () => {
    try {
      await step.mutateAsync(n + 1);
      router.push(onboardingPath(n + 1));
    } catch (e) {
      toast({ tone: 'danger', message: errorMessage(e, t) });
    }
  };
  return { go, saving: step.isPending };
}

function Shell({ slug, title, description, children }: { slug: OnboardingSlug; title: string; description: ReactNode; children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const current = stepNumber(slug);
  const items: StepItem[] = ONBOARDING_STEPS.map((s, i) => ({
    key: s,
    label: t(STEP_LABEL[s]),
    state: i + 1 < current ? 'done' : i + 1 === current ? 'active' : 'upcoming',
    onSelect: () => router.push(`/onboarding/${s}`),
  }));
  return (
    <Card className="mx-auto w-full max-w-[680px] p-6 sm:p-9">
      <Steps items={items} label={t('onboarding.stepsLabel')} />
      <h1 className="ts-display-m mt-5">{title}</h1>
      <p className="ts-body mt-4 text-text-secondary">{description}</p>
      <div className="mt-5">{children}</div>
      <p className="ts-label-micro mt-10 text-text-muted">{t('onboarding.progress', { step: current, total: ONBOARDING_STEPS.length })}</p>
    </Card>
  );
}

function Nav({ back, backLabel, onLater, saving, primary }: { back: OnboardingSlug; backLabel: string; onLater: () => void; saving: boolean; primary: ReactNode }) {
  const t = useT();
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <Link href={`/onboarding/${back}`} className={buttonClass({ variant: 'ghost', className: 'me-auto' })}>
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {backLabel}
      </Link>
      <Button variant="ghost" onClick={onLater} disabled={saving}>
        {t('action.later')}
      </Button>
      {primary}
    </div>
  );
}

/* ---------- 1. Welcome ---------- */
function Welcome() {
  const t = useT();
  const { me } = useSession();
  const { go, saving } = useAdvance('welcome');
  const tiles = ['stock', 'product', 'agent', 'page', 'ready'] as const;
  return (
    <Shell slug="welcome" title={t('onboarding.welcome.title', { name: me?.firstName ?? '' })} description={t('onboarding.welcome.description')}>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {tiles.map((k) => (
          <li key={k} className="rounded-card bg-ink-raised px-2.5 py-2.5">
            <div className="text-[14px] font-medium">{t(`onboarding.welcome.tile.${k}.title`)}</div>
            <div className="ts-label-meta mt-1 truncate text-text-muted">{t(`onboarding.welcome.tile.${k}.hint`)}</div>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={go} loading={saving}>
          {saving ? t('onboarding.continuing') : t('onboarding.welcome.start')}
        </Button>
      </div>
    </Shell>
  );
}

/* ---------- 2. Stock mode ---------- */
function StockMode() {
  const t = useT();
  const { workspace } = useSession();
  const [mode, setMode] = useState<'simple' | 'advanced'>(workspace?.stockMode ?? 'simple');
  const patch = usePatchWorkspace();
  const { go, saving } = useAdvance('stock-mode');
  const [error, setError] = useState<string | null>(null);
  const busy = patch.isPending || saving;
  const save = async () => {
    setError(null);
    try {
      if (workspace && mode !== workspace.stockMode) await patch.mutateAsync({ stockMode: mode, version: workspace.version });
      await go();
    } catch (e) {
      setError(errorMessage(e, t));
    }
  };
  return (
    <Shell slug="stock-mode" title={t('onboarding.stock.title')} description={t('onboarding.stock.description')}>
      <div role="radiogroup" aria-label={t('nav.settings.stockMode')} className="flex flex-col gap-5">
        {(['simple', 'advanced'] as const).map((m) => (
          <OptionCard
            key={m}
            name={m}
            selected={mode === m}
            onSelect={() => setMode(m)}
            disabled={busy}
            icon={<Box className="size-5" aria-hidden />}
            title={t(`settings.stockMode.${m}.title`)}
            description={t(`settings.stockMode.${m}.description`)}
            badge={t('enum.Workspace.status.active')}
          />
        ))}
      </div>
      {error ? <FormAlert className="mt-4">{error}</FormAlert> : null}
      <Nav
        back="welcome"
        backLabel={t('onboarding.step.welcome')}
        onLater={go}
        saving={busy}
        primary={
          <Button variant="primary" onClick={save} loading={busy}>
            {busy ? t('onboarding.continuing') : t('onboarding.continue')}
          </Button>
        }
      />
    </Shell>
  );
}

/* ---------- 3. First product (catalogue endpoints arrive with M2) ---------- */
function FirstProduct() {
  const t = useT();
  const { go, saving } = useAdvance('first-product');
  const later = t('onboarding.availableLater');
  return (
    <Shell slug="first-product" title={t('onboarding.product.title')} description={t('onboarding.product.description')}>
      <fieldset disabled title={later} className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <div className="flex h-[140px] flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line-lit text-text-muted">
          <Plus className="size-4" aria-hidden />
          <span className="ts-label-micro">{t('onboarding.product.photo')}</span>
          <span className="ts-label-meta text-accent-money">✦ {t('onboarding.product.aiFill')}</span>
        </div>
        <div className="flex flex-col gap-3">
          <Field label={t('common.name')} htmlFor="p-name" required>
            <Input id="p-name" placeholder={t('onboarding.product.namePlaceholder')} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('onboarding.product.price')} htmlFor="p-price" required>
              <Input id="p-price" inputMode="numeric" dir="ltr" />
            </Field>
            <Field label={t('onboarding.product.stock')} htmlFor="p-stock" required>
              <Input id="p-stock" inputMode="numeric" dir="ltr" />
            </Field>
            <Field label={t('onboarding.product.category')} htmlFor="p-cat">
              <Select id="p-cat" defaultValue="">
                <option value="">{t('common.none')}</option>
              </Select>
            </Field>
          </div>
        </div>
      </fieldset>
      <p className="ts-label-meta mt-3 text-text-muted">{later}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" disabledReason={later} className="!h-auto min-h-10 !whitespace-normal py-2 text-start">
          {t('onboarding.product.importFile')}
        </Button>
        <Button variant="ghost" disabledReason={later} className="!h-auto min-h-10 !whitespace-normal py-2 text-start">
          {t('onboarding.product.extract')}
        </Button>
      </div>
      <Nav
        back="stock-mode"
        backLabel={t('onboarding.step.stock')}
        onLater={go}
        saving={saving}
        primary={
          <Button variant="primary" onClick={go} loading={saving}>
            {saving ? t('onboarding.continuing') : t('onboarding.product.submit')}
          </Button>
        }
      />
    </Shell>
  );
}

/* ---------- 4. Agent preset (agent endpoints arrive with M4) ---------- */
const PRESETS = ['vendeurPro', 'serviceClient', 'conseillerProduit', 'reponseExpress'] as const;
function AgentPreset() {
  const t = useT();
  const { go, saving } = useAdvance('agent');
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>('vendeurPro');
  return (
    <Shell slug="agent" title={t('onboarding.agent.title')} description={t('onboarding.agent.description')}>
      <div role="radiogroup" aria-label={t('onboarding.agent.title')} className="grid gap-3 sm:grid-cols-2">
        {PRESETS.map((p, i) => {
          const selected = preset === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPreset(p)}
              className={cn('flex flex-col rounded-card border bg-ink-surface p-4 text-start', selected ? 'border-accent-money' : 'border-line-hairline hover:border-line-edge')}
            >
              <span className="flex w-full items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-card bg-ink-raised text-accent-money">
                  <Bot className="size-5" aria-hidden />
                </span>
                {i === 0 ? <span className="ts-label-micro text-text-muted">{t('onboarding.agent.recommended')}</span> : null}
              </span>
              <span className="ts-display-s mt-3">{t(`onboarding.agent.preset.${p}.name`)}</span>
              <span className="mt-1 text-[13px] text-text-muted">{t(`onboarding.agent.preset.${p}.tagline`)}</span>
              <ul className="mt-3 flex flex-col gap-1.5 text-[13px] text-text-secondary">
                {[1, 2, 3].map((n) => (
                  <li key={n} className="flex items-center gap-2">
                    <span className="size-1 rounded-full bg-text-muted" aria-hidden />
                    {t(`onboarding.agent.preset.${p}.point${n}`)}
                  </li>
                ))}
              </ul>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium">
                {t('onboarding.agent.use')}
                <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </span>
            </button>
          );
        })}
      </div>
      <Button variant="ghost" className="mt-4 !h-auto min-h-10 !whitespace-normal py-2 text-start" onClick={go} disabled={saving}>
        {t('onboarding.agent.scratch')}
      </Button>
      <Nav
        back="first-product"
        backLabel={t('onboarding.step.product')}
        onLater={go}
        saving={saving}
        primary={
          <Button variant="primary" onClick={go} loading={saving}>
            {saving ? t('onboarding.continuing') : t('onboarding.agent.create', { name: t(`onboarding.agent.preset.${preset}.name`) })}
          </Button>
        }
      />
    </Shell>
  );
}

/* ---------- 5. Connect a page (channel endpoints arrive with M3; e-mail verification is checked now, D32) ---------- */
function Connect() {
  const t = useT();
  const { me } = useSession();
  const { go, saving } = useAdvance('connect');
  const [platform, setPlatform] = useState<'facebook' | 'instagram'>('facebook');
  const [cooldown, startCooldown] = useCooldown();
  const resend = useMutation({ mutationFn: authApi.resendVerification });
  const unverified = !!me && !me.emailVerifiedAt;
  const onResend = async () => {
    try {
      await resend.mutateAsync();
      toast(t('auth.verify.resent', { email: me?.email ?? '' }));
      startCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      const wait = retryAfterSeconds(e, RESEND_COOLDOWN_S);
      if (wait > 0) startCooldown(wait);
      else toast({ tone: 'danger', message: errorMessage(e, t) });
    }
  };
  return (
    <Shell slug="connect" title={t('onboarding.connect.title')} description={t('onboarding.connect.description')}>
      <div role="radiogroup" aria-label={t('onboarding.connect.title')} className="flex flex-col gap-5">
        {(['facebook', 'instagram'] as const).map((p) => (
          <OptionCard
            key={p}
            name={p}
            selected={platform === p}
            onSelect={() => setPlatform(p)}
            icon={<Box className="size-5" aria-hidden />}
            title={t(`onboarding.connect.${p}.title`)}
            description={t(`onboarding.connect.${p}.description`)}
            badge={t('enum.Workspace.status.active')}
          />
        ))}
      </div>
      <div className="mt-5 rounded-card bg-ink-raised px-3.5 py-3">
        <div className="ts-label-micro text-text-muted">{t('onboarding.connect.never.title')}</div>
        <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-text-secondary">
          {[1, 2, 3].map((n) => (
            <li key={n} className="flex items-center gap-2">
              <X className="size-3.5 shrink-0" aria-hidden />
              {t(`onboarding.connect.never.item${n}`)}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 rounded-card border-s-2 border-s-accent-starred bg-ink-raised px-3.5 py-3 text-[13px] text-text-secondary">{t('onboarding.connect.instagramPending')}</div>
      {unverified ? (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-card border-s-2 border-s-accent-alert bg-ink-raised px-3.5 py-3 text-[13px]">
          <span className="min-w-0 flex-1">{t('onboarding.connect.unverified', { email: me?.email ?? '' })}</span>
          <Button size="sm" onClick={onResend} loading={resend.isPending} disabled={cooldown > 0}>
            {cooldown > 0 ? t('action.resendIn', { time: formatClock(cooldown) }) : t('action.resend')}
          </Button>
        </div>
      ) : null}
      <Nav
        back="agent"
        backLabel={t('onboarding.step.agent')}
        onLater={go}
        saving={saving}
        primary={
          <Button variant="primary" onClick={go} loading={saving} disabledReason={unverified ? t('error.AUTH_EMAIL_UNVERIFIED') : undefined}>
            {saving ? t('onboarding.continuing') : t(`onboarding.connect.${platform}.submit`)}
          </Button>
        }
      />
    </Shell>
  );
}

/* ---------- 6. Ready: what is done / skipped, from the Get Started checklist ---------- */
function Ready() {
  const t = useT();
  const { workspace } = useSession();
  const home = useOnboarding();
  const list = checklistOf(home.data);
  const rows: { key: string; done: boolean; title: string; hint: string }[] = [
    { key: 'stock', done: true, title: t('onboarding.ready.stock', { mode: t(`settings.stockMode.${workspace?.stockMode ?? 'simple'}.title`) }), hint: t('onboarding.ready.stockHint') },
    { key: 'product', done: list.product, title: t(list.product ? 'onboarding.ready.productDone' : 'onboarding.ready.productTodo'), hint: t('onboarding.ready.productHint') },
    { key: 'agent', done: list.agent, title: t(list.agent ? 'onboarding.ready.agentDone' : 'onboarding.ready.agentTodo'), hint: t('onboarding.ready.agentHint') },
    { key: 'page', done: list.channel, title: t(list.channel ? 'onboarding.ready.pageDone' : 'onboarding.ready.pageTodo'), hint: t('onboarding.ready.pageHint') },
    { key: 'sale', done: list.sale, title: t('onboarding.ready.sale'), hint: t('onboarding.ready.saleHint') },
  ];
  return (
    <Shell slug="ready" title={t('onboarding.ready.title')} description={t('onboarding.ready.description', { workspace: workspace?.name ?? '' })}>
      {home.isPending ? (
        <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : home.isError ? (
        <QueryError error={home.error} onRetry={() => home.refetch()} />
      ) : (
        <ul className="divide-y divide-line-hairline rounded-card bg-ink-raised px-3.5">
          {rows.map((r) => (
            <li key={r.key} data-step={r.key}>
              <ChecklistRow done={r.done} title={r.title} description={r.hint} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/agents" className={buttonClass()}>
          {t('onboarding.ready.testAgent')}
        </Link>
        <Link href="/products/import" className={buttonClass()}>
          {t('onboarding.ready.importCatalogue')}
        </Link>
        <Link href="/settings/members" className={buttonClass({ variant: 'ghost' })}>
          {t('onboarding.ready.inviteTeam')}
        </Link>
      </div>
      <div className="mt-5 flex justify-end">
        <Link href="/home" className={buttonClass({ variant: 'primary' })}>
          {t('onboarding.ready.goHome')}
        </Link>
      </div>
    </Shell>
  );
}

export function OnboardingStep({ slug }: { slug: OnboardingSlug }) {
  switch (slug) {
    case 'welcome':
      return <Welcome />;
    case 'stock-mode':
      return <StockMode />;
    case 'first-product':
      return <FirstProduct />;
    case 'agent':
      return <AgentPreset />;
    case 'connect':
      return <Connect />;
    case 'ready':
      return <Ready />;
  }
}
