import { describe, expect, it } from 'vitest';

import { cellStatus, weekStatus } from './program-roadmap';

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

  it('lets the week decide first — any day of an earlier week is done', () => {
    expect(cellStatus(1, 0, cursor)).toBe('done');
    expect(cellStatus(1, 4, cursor)).toBe('done');
  });

  it('lets the week decide first — any day of a later week is upcoming', () => {
    expect(cellStatus(3, 0, cursor)).toBe('upcoming');
    expect(cellStatus(3, 1, cursor)).toBe('upcoming');
  });

  it('resolves the day within the current week', () => {
    expect(cellStatus(2, 0, cursor)).toBe('done');
    expect(cellStatus(2, 1, cursor)).toBe('current');
    expect(cellStatus(2, 2, cursor)).toBe('upcoming');
  });

  it('marks the very first day of a fresh program as current', () => {
    expect(cellStatus(1, 0, { currentWeek: 1, currentDayIndex: 0 })).toBe(
      'current',
    );
  });
});
