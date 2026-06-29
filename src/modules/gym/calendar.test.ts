import { describe, expect, it } from 'vitest';

import {
  addMonths,
  groupSessionDays,
  monthGrid,
  startOfDay,
  startOfMonth,
} from './calendar';
import { dayKey } from './streak';

describe('startOfMonth / addMonths', () => {
  it('returns the first of the month at midnight', () => {
    const d = startOfMonth(new Date(2024, 5, 17, 9, 30));
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('moves whole months in either direction, normalizing year', () => {
    expect(addMonths(new Date(2024, 0, 15), -1).getMonth()).toBe(11); // Dec
    expect(addMonths(new Date(2024, 0, 15), -1).getFullYear()).toBe(2023);
    expect(addMonths(new Date(2024, 11, 1), 1).getMonth()).toBe(0); // Jan
    expect(addMonths(new Date(2024, 11, 1), 1).getFullYear()).toBe(2025);
  });
});

describe('monthGrid', () => {
  it('is a fixed 6×7 grid starting on a Monday', () => {
    const weeks = monthGrid(new Date(2024, 5, 1)); // June 2024
    expect(weeks).toHaveLength(6);
    for (const week of weeks) expect(week).toHaveLength(7);
    // June 2024 starts on a Saturday → grid's first cell is Mon May 27.
    expect(weeks[0]![0]!.getDay()).toBe(1); // Monday
    expect(weeks[0]![0]!.getMonth()).toBe(4); // May
    expect(weeks[0]![0]!.getDate()).toBe(27);
  });

  it('contains every day of the target month', () => {
    const weeks = monthGrid(new Date(2024, 1, 1)); // February 2024 (leap)
    const flat = weeks.flat();
    const febDays = flat
      .filter((d) => d.getMonth() === 1)
      .map((d) => d.getDate());
    expect(febDays).toContain(1);
    expect(febDays).toContain(29); // leap day
    expect(Math.max(...febDays)).toBe(29);
  });
});

describe('groupSessionDays', () => {
  it('buckets finished sessions by completion day, ignoring unfinished', () => {
    const day1 = new Date(2024, 5, 10, 8, 0);
    const day1Evening = new Date(2024, 5, 10, 19, 0);
    const day2 = new Date(2024, 5, 12, 8, 0);
    const map = groupSessionDays([
      { id: 1, finishedAt: day1 },
      { id: 2, finishedAt: day1Evening },
      { id: 3, finishedAt: day2 },
      { id: 4, finishedAt: null },
    ]);
    expect(map.get(dayKey(day1))).toEqual([1, 2]);
    expect(map.get(dayKey(day2))).toEqual([3]);
    expect(map.size).toBe(2);
  });
});

describe('startOfDay', () => {
  it('zeroes the time component', () => {
    const d = startOfDay(new Date(2024, 5, 10, 14, 30, 15));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getDate()).toBe(10);
  });
});
