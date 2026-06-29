import { describe, expect, it } from 'vitest';

import {
  type StrengthSet,
  type VolumeSet,
  e1rmTrend,
  seriesPeak,
  seriesTotal,
  weeklySetCount,
  weeklyTonnage,
} from './analytics';

// A fixed Monday (2024-01-01 is a Monday) keeps week buckets deterministic.
const MON_W1 = new Date(2024, 0, 1, 12, 0, 0).getTime();
const MON_W2 = new Date(2024, 0, 8, 12, 0, 0).getTime();
const MON_W4 = new Date(2024, 0, 22, 12, 0, 0).getTime();

function set(partial: Partial<VolumeSet> & { finishedAt: number }): VolumeSet {
  return {
    reps: 10,
    weight: 100,
    setType: 'working',
    measurementKind: 'weight_reps',
    ...partial,
  };
}

describe('weeklyTonnage', () => {
  it('sums reps×weight per week for hard, load-bearing sets', () => {
    const sets = [
      set({ finishedAt: MON_W1, reps: 5, weight: 100 }), // 500
      set({ finishedAt: MON_W1, reps: 5, weight: 100 }), // 500
      set({ finishedAt: MON_W2, reps: 10, weight: 60 }), // 600
    ];
    const points = weeklyTonnage(sets, 0, MON_W2);
    expect(points).toHaveLength(2);
    expect(points[0]!.value).toBe(1000);
    expect(points[1]!.value).toBe(600);
  });

  it('excludes warm-ups and non-load-bearing kinds', () => {
    const sets = [
      set({ finishedAt: MON_W1, reps: 5, weight: 100 }), // counts (500)
      set({ finishedAt: MON_W1, setType: 'warmup', reps: 5, weight: 100 }),
      set({
        finishedAt: MON_W1,
        measurementKind: 'duration',
        reps: 1,
        weight: 0,
      }),
    ];
    expect(weeklyTonnage(sets, 0, MON_W1)[0]!.value).toBe(500);
  });

  it('counts drop and failure sets as hard volume', () => {
    const sets = [
      set({ finishedAt: MON_W1, setType: 'drop', reps: 5, weight: 40 }), // 200
      set({ finishedAt: MON_W1, setType: 'failure', reps: 3, weight: 50 }), // 150
    ];
    expect(weeklyTonnage(sets, 0, MON_W1)[0]!.value).toBe(350);
  });

  it('zero-fills gap weeks so the x-axis is proportional to time', () => {
    const sets = [
      set({ finishedAt: MON_W1, reps: 5, weight: 100 }),
      set({ finishedAt: MON_W4, reps: 5, weight: 100 }),
    ];
    const points = weeklyTonnage(sets, 0, MON_W4);
    expect(points).toHaveLength(4); // W1..W4 inclusive
    expect(points.map((p) => p.value)).toEqual([500, 0, 0, 500]);
  });

  it('respects the range lower bound', () => {
    const sets = [
      set({ finishedAt: MON_W1, reps: 5, weight: 100 }),
      set({ finishedAt: MON_W4, reps: 5, weight: 100 }),
    ];
    // Only W4 falls inside [MON_W2, MON_W4].
    const points = weeklyTonnage(sets, MON_W2, MON_W4);
    expect(points).toHaveLength(1);
    expect(points[0]!.value).toBe(500);
  });

  it('returns an empty series when no sets fall in range', () => {
    expect(weeklyTonnage([], 0, MON_W1)).toEqual([]);
  });
});

describe('weeklySetCount', () => {
  it('counts non-warm-up sets per week', () => {
    const sets = [
      set({ finishedAt: MON_W1 }),
      set({ finishedAt: MON_W1, setType: 'warmup' }),
      set({ finishedAt: MON_W1, setType: 'drop' }),
    ];
    expect(weeklySetCount(sets, 0, MON_W1)[0]!.value).toBe(2);
  });
});

describe('e1rmTrend', () => {
  function strength(
    p: Partial<StrengthSet> & { sessionId: number },
  ): StrengthSet {
    return { finishedAt: MON_W1, reps: 5, weight: 100, ...p };
  }

  it('keeps the best estimate per session, oldest → newest', () => {
    const rows = [
      strength({ sessionId: 2, finishedAt: MON_W2, reps: 5, weight: 110 }),
      strength({ sessionId: 1, finishedAt: MON_W1, reps: 5, weight: 100 }),
      strength({ sessionId: 1, finishedAt: MON_W1, reps: 5, weight: 105 }), // best in s1
    ];
    const trend = e1rmTrend(rows);
    expect(trend).toHaveLength(2);
    // Chronological: session 1 (best of 100/105) then session 2.
    expect(trend[0]!).toBeLessThan(trend[1]!);
  });

  it('drops sessions with only high-rep (ungated) sets', () => {
    const rows = [strength({ sessionId: 1, reps: 30, weight: 50 })];
    expect(e1rmTrend(rows)).toEqual([]);
  });

  it('filters by the range lower bound', () => {
    const rows = [
      strength({ sessionId: 1, finishedAt: MON_W1 }),
      strength({ sessionId: 2, finishedAt: MON_W4 }),
    ];
    expect(e1rmTrend(rows, MON_W2)).toHaveLength(1);
  });
});

describe('series aggregates', () => {
  it('totals and peaks a weekly series', () => {
    const points = [
      { weekStart: MON_W1, value: 500 },
      { weekStart: MON_W2, value: 800 },
    ];
    expect(seriesTotal(points)).toBe(1300);
    expect(seriesPeak(points)).toBe(800);
  });

  it('peaks to 0 for an empty series', () => {
    expect(seriesPeak([])).toBe(0);
    expect(seriesTotal([])).toBe(0);
  });
});
