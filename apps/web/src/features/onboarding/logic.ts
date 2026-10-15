// Onboarding tunnel (ONB-01) — pure decisions of the steps: what already exists when a step is reopened, where the
// Ready step's next actions lead, and when they are unavailable.

type AgentRow = { id: string; name: string; status: 'draft' | 'active' | 'paused'; updatedAt?: string | null };
type ChannelRow = { id: string; name: string; status: string };
type PlanLike = { limits: { maxMembers: number; maxProducts: number }; usage: { members: number; products: number } } | null | undefined;

/** "Partir de zéro" of step 4: the agent wizard (steps 1–3 run inside the tunnel, see `isTunnelTransit`). */
export const SCRATCH_WIZARD_PATH = '/agents/new?start=scratch';

/** The agent "Tester mon agent" opens: an active (or paused) agent first, else the most recent draft. */
export const agentToTest = <A extends AgentRow>(rows: readonly A[] | null | undefined): A | null => {
  const list = [...(rows ?? [])].sort((a, b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? '') || 0);
  return list.find((a) => a.status !== 'draft') ?? list[0] ?? null;
};

/**
 * Where an agent is tested: the playground tab of its page; a draft has no page (it resumes in the wizard), its test
 * lives on wizard step 5 "Test & activation" ("Tester moi-même", the 8 scenarios).
 */
export const agentTestPath = (a: Pick<AgentRow, 'id' | 'status'>): string => (a.status === 'draft' ? `/agents/new/activate?draft=${a.id}` : `/agents/${a.id}/playground`);

/** Pages that still count as connected on step 5 (a disconnected or disabled page does not). */
export const connectedChannels = <C extends ChannelRow>(rows: readonly C[] | null | undefined): C[] => (rows ?? []).filter((c) => c.status !== 'disconnected' && c.status !== 'disabled');

/** Plan limit reached for a resource (-1 = unlimited): `{ current, limit }`, else null. */
export const limitReached = (plan: PlanLike, resource: 'members' | 'products'): { current: number; limit: number } | null => {
  if (!plan) return null;
  const limit = resource === 'members' ? plan.limits.maxMembers : plan.limits.maxProducts;
  const current = resource === 'members' ? plan.usage.members : plan.usage.products;
  return limit !== -1 && current >= limit ? { current, limit } : null;
};
