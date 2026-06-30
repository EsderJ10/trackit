import { describe, expect, it } from 'vitest';

import { cellKey, cellStatus, weekStatus } from './program-roadmap';

const none: ReadonlySet<string> = new Set();
const logged = (...cells: [number, number][]): ReadonlySet<string> =>
  new Set(cells.map(([w, d]) => cellKey(w, d)));

describe('weekStatus', () => {
  it('marks earlier weeks done, the cursor week current, later weeks upcoming', () => {
    expect(weekStatus(1, 3)).toBe('done');
    expect(weekStatus(2, 3)).toBe('done');
    expect(weekStatus(3, 3)).toBe('current');
    expect(weekStatus(4, 3)).toBe('upcoming');
  });

  it('treats week 1 as current at the start of a program', () => {
    expect(weekStatus(1, 1)).toBe('current');
    expect(weekStatus(2, 1)).toBe('upcoming');
  });
});

describe('cellStatus', () => {
  const cursor = { currentWeek: 2, currentDayIndex: 1 };

  it('marks a cell with a logged session done, even ahead of the cursor', () => {
    expect(cellStatus(1, 0, cursor, logged([1, 0]))).toBe('done');
    expect(cellStatus(3, 0, cursor, logged([3, 0]))).toBe('done');
  });

  it('marks a passed cell with NO session as skipped, not done', () => {
    // Earlier week, never logged → a recoverable gap.
    expect(cellStatus(1, 0, cursor, none)).toBe('skipped');
    expect(cellStatus(1, 4, cursor, none)).toBe('skipped');
    // Earlier day of the current week, never logged → skipped.
    expect(cellStatus(2, 0, cursor, none)).toBe('skipped');
  });

  it('marks the cursor cell current and later cells upcoming', () => {
    expect(cellStatus(2, 1, cursor, none)).toBe('current');
    expect(cellStatus(2, 2, cursor, none)).toBe('upcoming');
    expect(cellStatus(3, 0, cursor, none)).toBe('upcoming');
  });

  it('resolves a partly-logged current week — done past + skipped gap + current', () => {
    // Day 0 logged, day 1 is the cursor, day 2 is still upcoming.
    expect(cellStatus(2, 0, cursor, logged([2, 0]))).toBe('done');
    expect(cellStatus(2, 1, cursor, logged([2, 0]))).toBe('current');
    expect(cellStatus(2, 2, cursor, logged([2, 0]))).toBe('upcoming');
  });

  it('marks the very first day of a fresh program as current', () => {
    expect(cellStatus(1, 0, { currentWeek: 1, currentDayIndex: 0 }, none)).toBe(
      'current',
    );
  });
});
