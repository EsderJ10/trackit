// Pure superset grouping for routine templates. A `supersetGroup` is an opaque id
// shared by back-to-back exercises; rows sharing one (≥2 members) form a superset,
// labeled A/B/… in order of first appearance.

export interface SupersetRow {
  id: number;
  supersetGroup: number | null;
}

export interface SupersetBadge {
  /** Display letter for the group (A, B, …), by order of first appearance. */
  letter: string;
  /** 1-based position of this row within its group (the "1" in "A1"). */
  ordinal: number;
  /** How many exercises are in the group. */
  size: number;
}

export interface SupersetUpdate {
  id: number;
  supersetGroup: number | null;
}

/** Badges keyed by row id for rows in a real superset (group of ≥2); singletons ignored. */
export function supersetBadges(
  rows: SupersetRow[],
): Map<number, SupersetBadge> {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.supersetGroup != null) {
      counts.set(row.supersetGroup, (counts.get(row.supersetGroup) ?? 0) + 1);
    }
  }

  const letters = new Map<number, string>();
  const ordinals = new Map<number, number>();
  const badges = new Map<number, SupersetBadge>();
  let nextLetter = 0;
  for (const row of rows) {
    const group = row.supersetGroup;
    if (group == null || (counts.get(group) ?? 0) < 2) continue;
    if (!letters.has(group)) {
      letters.set(group, String.fromCharCode(65 + nextLetter));
      nextLetter += 1;
    }
    const ordinal = (ordinals.get(group) ?? 0) + 1;
    ordinals.set(group, ordinal);
    badges.set(row.id, {
      letter: letters.get(group)!,
      ordinal,
      size: counts.get(group)!,
    });
  }
  return badges;
}

/**
 * Link the row at `index` into a superset with the row above it: joins the prev
 * row's group, else creates one keyed by the prev row's id (a globally unique PK,
 * so group ids never collide). Returns updates to persist (empty for `index <= 0`).
 */
export function linkWithPrevious(
  rows: SupersetRow[],
  index: number,
): SupersetUpdate[] {
  if (index <= 0 || index >= rows.length) return [];
  const prev = rows[index - 1]!;
  const current = rows[index]!;
  if (prev.supersetGroup != null) {
    return [{ id: current.id, supersetGroup: prev.supersetGroup }];
  }
  return [
    { id: prev.id, supersetGroup: prev.id },
    { id: current.id, supersetGroup: prev.id },
  ];
}

/**
 * Remove a row from its superset. If only one member would remain, that member
 * is cleared too (a superset needs ≥2). Returns the updates to persist.
 */
export function unlink(rows: SupersetRow[], id: number): SupersetUpdate[] {
  const row = rows.find((r) => r.id === id);
  if (!row || row.supersetGroup == null) return [];
  const members = rows.filter((r) => r.supersetGroup === row.supersetGroup);
  const updates: SupersetUpdate[] = [{ id, supersetGroup: null }];
  if (members.length <= 2) {
    for (const member of members) {
      if (member.id !== id)
        updates.push({ id: member.id, supersetGroup: null });
    }
  }
  return updates;
}
