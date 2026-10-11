// Reordering helpers for the quick replies list (drag & drop and the "Monter / Descendre" actions).

/** Moves `id` by `delta` positions; out-of-range moves return the same list. */
export const moveBy = (ids: string[], id: string, delta: number): string[] => {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  next.splice(j, 0, next.splice(i, 1)[0]!);
  return next;
};

/** Moves `id` to the position of `targetId` (drop on a row). */
export const moveTo = (ids: string[], id: string, targetId: string): string[] => {
  const from = ids.indexOf(id);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]!);
  return next;
};
