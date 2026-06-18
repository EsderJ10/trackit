import { describe, expect, it } from 'vitest';

import {
  computeLongestStreak,
  computeStreakWeeks,
  startOfWeek,
} from './streak';

/** Build the logged-week-start set from arbitrary dates within each week. */
function weekSet(...dates: Date[]): Set<number> {
  return new Set(dates.map((d) => startOfWeek(d).getTime()));
}

describe('startOfWeek', () => {
  it('normalizes any day to its local Monday midnight', () => {
    // 2024-06-18 is a Tuesday → Monday is 2024-06-17.
    const monday = startOfWeek(new Date(2024, 5, 18, 14, 30));
    expect(monday.getFullYear()).toBe(2024);
    expect(monday.getMonth()).toBe(5);
    expect(monday.getDate()).toBe(17);
    expect(monday.getHours()).toBe(0);
    // Sunday belongs to the week that started the previous Monday.
    expect(startOfWeek(new Date(2024, 5, 23)).getDate()).toBe(17);
  });
});

describe('computeStreakWeeks', () => {
  const today = new Date(2024, 5, 18); // Tuesday
  const current = startOfWeek(today);

  it('counts the current week plus consecutive prior weeks', () => {
    const logged = weekSet(
      new Date(2024, 5, 18), // this week
      new Date(2024, 5, 11), // last week
      new Date(2024, 5, 4), // two weeks ago
    );
    expect(computeStreakWeeks(logged, current)).toBe(3);
  });

  it('keeps the streak alive when the current week has no session yet', () => {
    // No session this week, but the prior two weeks are logged → still 2.
    const logged = weekSet(new Date(2024, 5, 11), new Date(2024, 5, 4));
    expect(computeStreakWeeks(logged, current)).toBe(2);
  });

  it('resets after a fully missed intermediate week', () => {
    // This week + skip last week + an older week → only this week counts.
    const logged = weekSet(new Date(2024, 5, 18), new Date(2024, 5, 4));
    expect(computeStreakWeeks(logged, current)).toBe(1);
  });

  it('is zero when neither this week nor last week is logged', () => {
    expect(computeStreakWeeks(weekSet(new Date(2024, 4, 1)), current)).toBe(0);
    expect(computeStreakWeeks(new Set(), current)).toBe(0);
  });
});

describe('computeLongestStreak', () => {
  it('is zero for no logged weeks', () => {
    expect(computeLongestStreak(new Set())).toBe(0);
  });

  it('counts a single week as 1', () => {
    expect(computeLongestStreak(weekSet(new Date(2024, 5, 4)))).toBe(1);
  });

  it('measures the longest run, ignoring gaps and current-week grace', () => {
    // Run of 3 (Apr 1, 8, 15), gap, then a run of 2 (May 6, 13) → longest is 3.
    const logged = weekSet(
      new Date(2024, 3, 1),
      new Date(2024, 3, 8),
      new Date(2024, 3, 15),
      new Date(2024, 4, 6),
      new Date(2024, 4, 13),
    );
    expect(computeLongestStreak(logged)).toBe(3);
  });

  it('does not let set iteration order inflate a run', () => {
    // Two separate single weeks far apart → longest run is 1, not 2.
    expect(
      computeLongestStreak(weekSet(new Date(2024, 0, 1), new Date(2024, 5, 1))),
    ).toBe(1);
  });
});
