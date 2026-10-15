'use client';
// Shell pieces of the billing module (02-next-route-map §2.1 BannerStack; 12 §0 "Plan expired"; GLOBAL "Plan expired —
// free limits applied (Channels)"): the banners `planExpired` (free limits applied, Choisir un plan), `planExpiring`
// (trial or paid plan ending in ≤ 7 days, Renouveler / Choisir un plan) and the dunning banner (unpaid renewal invoice,
// Payer maintenant) — shown in their priority slot by BannerStack, hidden on the billing pages that show them inline —
// and the WS `workspace.updated` handler that refreshes plan, limits and banners after a subscription change.
import { formatDate, formatNumber, type AppLocale } from '@djaber/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { ShellBanner } from '@/components/shell/banner-stack';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useSession, useWorkspaceId } from '@/lib/session';
import { useWsEvent } from '@/lib/ws';
import { billingKeys, usePlans, useSubscription } from './api';
import { usePayInvoice } from './invoices';
import { daysLeft, isFreePlan, planBanner, type PlanState } from './logic';

type WorkspacePlan = { slug: string; name: string; status: string; periodEnd: string; limits: { maxPages: number; maxAgents: number }; usage: { pages: number; agents: number } } & {
  // M9 fields of `GET /workspace` `plan` (contract-ready answer 1): the banners of members without `billing.read`
  trialEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  dunningStage?: PlanState['dunningStage'];
  expired?: { planName: string; at: string } | null;
  paused?: { channels: number; agents: number; members: number };
};

export function usePlanBanners(): ShellBanner[] {
  const t = useT();
  const locale = useLocaleCode() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const { workspace, can } = useSession();
  const sub = useSubscription();
  const plans = usePlans(!!sub.data?.expiredFrom);
  // "Payer maintenant" pays the unpaid invoice right away (Chargily checkout), like the invoices list
  const payInvoice = usePayInvoice();
  const wp = (workspace?.plan ?? null) as WorkspacePlan | null;
  // the billing pages show the same message inline (BIL-01)
  if (pathname.startsWith('/settings/billing')) return [];
  const s = sub.data;
  const state: PlanState | null = s
    ? {
        status: s.status,
        periodEnd: s.currentPeriodEnd,
        trialEndsAt: s.trialEndsAt,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        dunningStage: s.dunningStage,
        expired: s.expiredFrom ? { at: s.expiredFrom.at, planName: s.expiredFrom.planName } : null,
        free: isFreePlan(s.plan) && s.status !== 'trial',
      }
    : wp
      ? {
          status: (wp.status as PlanState['status']) ?? 'active',
          periodEnd: wp.periodEnd,
          trialEndsAt: wp.trialEndsAt ?? null,
          cancelAtPeriodEnd: wp.cancelAtPeriodEnd ?? false,
          dunningStage: wp.dunningStage ?? null,
          expired: wp.expired ?? null,
          free: wp.slug === 'free',
        }
      : null;
  const id = planBanner(state);
  if (!id || !state) return [];
  const billing = can('billing.read');
  const open = (href: string) => () => router.push(href);

  if (id === 'planExpired') {
    const free = s ? s.plan : (plans.data ?? []).find((p) => isFreePlan(p));
    const limits = free?.limits ?? wp?.limits;
    return [
      {
        id: 'planExpired',
        tone: 'warning',
        content: t('banner.planExpired', { date: formatDate(state.expired?.at ?? state.periodEnd, locale), pages: limits?.maxPages ?? 1, agents: limits?.maxAgents ?? 1 }),
        action: billing ? { label: t('action.choosePlan'), onClick: open('/settings/billing') } : undefined,
      },
    ];
  }
  if (id === 'dunning') {
    const inv = s?.unpaidInvoice;
    return [
      {
        id: 'dunning',
        tone: 'danger',
        content: inv
          ? t('billing.banner.dunning', { number: inv.number, amount: formatNumber(inv.remaining || inv.amount), plan: s!.plan.name, date: formatDate(new Date(Date.parse(state.periodEnd) + 7 * 86_400_000).toISOString(), locale) })
          : t('billing.banner.dunningShort', { plan: wp?.name ?? s?.plan.name ?? '' }),
        action: inv && can('billing.write') ? { label: t('billing.invoices.payNow'), onClick: () => void payInvoice.run(inv.id), disabled: payInvoice.pending === inv.id } : billing ? { label: t('billing.banner.seeInvoice'), onClick: open('/settings/billing') } : undefined,
      },
    ];
  }
  const end = state.status === 'trial' ? (state.trialEndsAt ?? state.periodEnd) : state.periodEnd;
  const planName = s?.plan.name ?? wp?.name ?? '';
  const usage = s?.usage ?? wp?.usage;
  return [
    {
      id: 'planExpiring',
      tone: 'warning',
      content: t('banner.planExpiring', { plan: planName, days: daysLeft(end), date: formatDate(end, locale), pages: usage?.pages ?? 0, agents: usage?.agents ?? 0 }),
      action: can('billing.plan')
        ? state.status === 'trial'
          ? { label: t('action.choosePlan'), onClick: open('/settings/billing') }
          : { label: t('action.renew'), onClick: open(`/settings/billing?change=${s?.plan.slug ?? wp?.slug ?? ''}`) }
        : undefined,
    },
  ];
}

/** WS `workspace.updated { workspace: { status, subscription } }`: the plan, its limits and the banners are refetched. */
export function useBillingEvents() {
  const ws = useWorkspaceId();
  const qc = useQueryClient();
  useWsEvent('workspace.updated', () => {
    void qc.invalidateQueries({ queryKey: billingKeys.all(ws) });
    void qc.invalidateQueries({ queryKey: [ws, 'workspace'] });
    void qc.invalidateQueries({ queryKey: [ws, 'credits'] });
  });
}
