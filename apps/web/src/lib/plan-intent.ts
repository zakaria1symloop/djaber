// Plan picked on the public pricing page (`/signup?plan=&cycle=`): every sign-up starts with the 14-day Pro trial (D60),
// so the choice is kept in this browser and offered once the shell is reached (banner "planIntent" →
// `/settings/billing?change=<slug>&cycle=`). Cleared when followed or dismissed.
import { planIntentOf, type PlanIntent } from '@/features/public/logic';

export const PLAN_INTENT_KEY = 'djaber.planIntent';

export function savePlanIntent(i: PlanIntent | null): void {
  try {
    if (i) window.localStorage.setItem(PLAN_INTENT_KEY, JSON.stringify(i));
  } catch {
    /* storage unavailable (private mode): the choice is simply not carried */
  }
}

export function readPlanIntent(): PlanIntent | null {
  try {
    const raw = window.localStorage.getItem(PLAN_INTENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PlanIntent>;
    return planIntentOf(v.plan, v.cycle);
  } catch {
    return null;
  }
}

export function clearPlanIntent(): void {
  try {
    window.localStorage.removeItem(PLAN_INTENT_KEY);
  } catch {
    /* ignore */
  }
}
