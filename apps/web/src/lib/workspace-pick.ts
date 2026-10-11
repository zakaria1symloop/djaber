import type { MeDto } from './contracts';

/** Workspace used for the session: stored choice when still a membership, else the owned one, else the first. */
export const pickWorkspaceId = (me: Pick<MeDto, 'ownedWorkspaceId' | 'memberships'> | null | undefined, stored: string | null): string | null => {
  if (!me || me.memberships.length === 0) return null;
  const ids = me.memberships.map((m) => m.workspaceId);
  if (stored && ids.includes(stored)) return stored;
  if (me.ownedWorkspaceId && ids.includes(me.ownedWorkspaceId)) return me.ownedWorkspaceId;
  return ids[0] ?? null;
};
