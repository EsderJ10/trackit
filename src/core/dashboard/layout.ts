// Pure (DB/React-free) helpers for the dashboard layout, persisted as JSON in
// `app_settings.dashboardLayout`. Core stays module-agnostic — only moves opaque ids.

export interface DashboardLayoutEntry {
  moduleId: string;
  hidden: boolean;
}

/** Parse stored layout JSON; `[]` on null/empty/malformed so a corrupt value never crashes Home. */
export function parseDashboardLayout(
  raw: string | null | undefined,
): DashboardLayoutEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: DashboardLayoutEntry[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.moduleId === 'string') {
      out.push({ moduleId: obj.moduleId, hidden: obj.hidden === true });
    }
  }
  return out;
}

/**
 * Reconcile stored layout against live module ids: keep existing (order + hidden,
 * deduped), append new modules visible in registry order, drop missing ones.
 */
export function reconcileLayout(
  stored: readonly DashboardLayoutEntry[],
  moduleIds: readonly string[],
): DashboardLayoutEntry[] {
  const known = new Set(moduleIds);
  const seen = new Set<string>();

  const kept: DashboardLayoutEntry[] = [];
  for (const entry of stored) {
    if (!known.has(entry.moduleId) || seen.has(entry.moduleId)) continue;
    seen.add(entry.moduleId);
    kept.push({ moduleId: entry.moduleId, hidden: entry.hidden });
  }

  const appended: DashboardLayoutEntry[] = moduleIds
    .filter((id) => !seen.has(id))
    .map((id) => ({ moduleId: id, hidden: false }));

  return [...kept, ...appended];
}

export function serializeDashboardLayout(
  entries: readonly DashboardLayoutEntry[],
): string {
  return JSON.stringify(
    entries.map((e) => ({ moduleId: e.moduleId, hidden: e.hidden })),
  );
}

/** Flip a module's visibility. Pure (new array). */
export function toggleHidden(
  entries: readonly DashboardLayoutEntry[],
  moduleId: string,
): DashboardLayoutEntry[] {
  return entries.map((e) =>
    e.moduleId === moduleId ? { ...e, hidden: !e.hidden } : { ...e },
  );
}

/** Move entry at `index` one slot in `dir` (-1 up, +1 down). Pure. */
export function moveEntry(
  entries: readonly DashboardLayoutEntry[],
  index: number,
  dir: -1 | 1,
): DashboardLayoutEntry[] {
  const target = index + dir;
  if (target < 0 || target >= entries.length) return [...entries];
  const a = entries[index];
  const b = entries[target];
  if (!a || !b) return [...entries];
  const next = entries.map((e) => ({ ...e }));
  next[index] = { ...b };
  next[target] = { ...a };
  return next;
}
