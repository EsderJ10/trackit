import { describe, expect, it } from 'vitest';

import {
  type SupersetRow,
  linkWithPrevious,
  supersetBadges,
  unlink,
} from './supersets';

function rows(...groups: (number | null)[]): SupersetRow[] {
  return groups.map((supersetGroup, index) => ({
    id: index + 1,
    supersetGroup,
  }));
}

describe('supersetBadges', () => {
  it('labels groups A/B by order of first appearance, with ordinals', () => {
    // rows: g1, g1, solo, g2, g2
    const badges = supersetBadges(rows(1, 1, null, 2, 2));
    expect(badges.get(1)).toEqual({ letter: 'A', ordinal: 1, size: 2 });
    expect(badges.get(2)).toEqual({ letter: 'A', ordinal: 2, size: 2 });
    expect(badges.has(3)).toBe(false); // solo exercise
    expect(badges.get(4)).toEqual({ letter: 'B', ordinal: 1, size: 2 });
    expect(badges.get(5)).toEqual({ letter: 'B', ordinal: 2, size: 2 });
  });

  it('ignores singleton groups (a lone exercise is not a superset)', () => {
    const badges = supersetBadges(rows(5, null, null));
    expect(badges.size).toBe(0);
  });

  it('handles a triple superset', () => {
    const badges = supersetBadges(rows(1, 1, 1));
    expect(badges.get(3)).toEqual({ letter: 'A', ordinal: 3, size: 3 });
  });
});

describe('linkWithPrevious', () => {
  it('does nothing at the top of the list', () => {
    expect(linkWithPrevious(rows(null, null), 0)).toEqual([]);
  });

  it('creates a new group for both rows when the previous is ungrouped', () => {
    const updates = linkWithPrevious(rows(null, null, null), 1);
    expect(updates).toEqual([
      { id: 1, supersetGroup: 1 },
      { id: 2, supersetGroup: 1 },
    ]);
  });

  it('joins the previous row’s existing group', () => {
    // rows: g1, g1, solo → link row 3 into the group
    const updates = linkWithPrevious(rows(1, 1, null), 2);
    expect(updates).toEqual([{ id: 3, supersetGroup: 1 }]);
  });

  it('picks a fresh group id above existing ones', () => {
    // rows: g2, solo, solo → link row 3 to row 2 (ungrouped) → new id 3
    const updates = linkWithPrevious(rows(2, null, null), 2);
    expect(updates).toEqual([
      { id: 2, supersetGroup: 3 },
      { id: 3, supersetGroup: 3 },
    ]);
  });
});

describe('unlink', () => {
  it('clears both members when removing from a pair (no singletons)', () => {
    const updates = unlink(rows(1, 1, null), 1);
    expect(updates).toContainEqual({ id: 1, supersetGroup: null });
    expect(updates).toContainEqual({ id: 2, supersetGroup: null });
    expect(updates).toHaveLength(2);
  });

  it('removes just one member from a triple', () => {
    const updates = unlink(rows(1, 1, 1), 2);
    expect(updates).toEqual([{ id: 2, supersetGroup: null }]);
  });

  it('is a no-op for an ungrouped row', () => {
    expect(unlink(rows(null, 1, 1), 1)).toEqual([]);
  });
});
