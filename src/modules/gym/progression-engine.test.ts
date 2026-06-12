import { describe, expect, it } from 'vitest';

import {
  advance,
  type DpScheme,
  type LpScheme,
  type ProgressionState,
  roundKg,
  suggestNext,
} from './progression-engine';

const lp: LpScheme = {
  type: 'lp',
  incrementKg: 2.5,
  failThreshold: 3,
  deloadPct: 0.1,
};

const dp: DpScheme = { type: 'dp', incrementKg: 2.5, minReps: 8, maxReps: 12 };

const state = (over: Partial<ProgressionState> = {}): ProgressionState => ({
  currentWeightKg: 100,
  currentReps: 5,
  successStreak: 0,
  failStreak: 0,
  ...over,
});

// All sets at the working weight and at least `reps` reps.
const sets = (count: number, reps: number, weightKg = 100) =>
  Array.from({ length: count }, () => ({ reps, weightKg }));

describe('roundKg', () => {
  it('rounds to the nearest 2.5 kg by default', () => {
    expect(roundKg(91.234)).toBe(90); // 36.49 → 36 × 2.5
    expect(roundKg(91.3)).toBe(92.5); // 36.52 → 37 × 2.5
  });

  it('honours a custom step and passes through a non-positive step', () => {
    expect(roundKg(103, 5)).toBe(105);
    expect(roundKg(103, 0)).toBe(103);
  });
});

describe('suggestNext', () => {
  it('renders targetSets identical sets from state', () => {
    const result = suggestNext(
      state({ currentWeightKg: 80, currentReps: 5 }),
      3,
    );
    expect(result).toEqual([
      { reps: 5, weightKg: 80 },
      { reps: 5, weightKg: 80 },
      { reps: 5, weightKg: 80 },
    ]);
  });

  it('always suggests at least one set', () => {
    expect(suggestNext(state(), 0)).toHaveLength(1);
  });
});

describe('advance — linear progression', () => {
  it('adds the increment after a successful session', () => {
    const { state: next, reason } = advance(lp, state(), sets(3, 5), 3);
    expect(next.currentWeightKg).toBe(102.5);
    expect(next.successStreak).toBe(1);
    expect(next.failStreak).toBe(0);
    expect(reason).toMatch(/\+2\.5 kg/);
  });

  it('keeps a non-2.5 increment exact on success (no grid snap)', () => {
    const micro: LpScheme = { ...lp, incrementKg: 1.25 };
    const { state: next } = advance(micro, state(), sets(3, 5), 3);
    expect(next.currentWeightKg).toBe(101.25); // not snapped to 102.5
  });

  it('holds the weight after a single miss', () => {
    const { state: next, reason } = advance(lp, state(), sets(3, 4), 3);
    expect(next.currentWeightKg).toBe(100);
    expect(next.failStreak).toBe(1);
    expect(reason).toMatch(/Repeat/);
  });

  it('treats too few completed sets as a miss', () => {
    const { state: next } = advance(lp, state(), sets(2, 5), 3);
    expect(next.failStreak).toBe(1);
    expect(next.currentWeightKg).toBe(100);
  });

  it('deloads after reaching the failure threshold', () => {
    const { state: next, reason } = advance(
      lp,
      state({ failStreak: 2 }),
      sets(3, 4),
      3,
    );
    expect(next.currentWeightKg).toBe(90); // 100 × 0.9
    expect(next.failStreak).toBe(0);
    expect(reason).toMatch(/−10% — missed 3 sessions/);
  });

  it('rounds a deload to a loadable weight', () => {
    const { state: next } = advance(
      lp,
      state({ currentWeightKg: 102.5, failStreak: 2 }),
      [],
      3,
    );
    // 102.5 × 0.9 = 92.25 → nearest 2.5 = 92.5
    expect(next.currentWeightKg).toBe(92.5);
  });
});

describe('advance — double progression', () => {
  it('climbs one rep when the target is met below the ceiling', () => {
    const { state: next, reason } = advance(
      dp,
      state({ currentReps: 8 }),
      sets(3, 8),
      3,
    );
    expect(next.currentReps).toBe(9);
    expect(next.currentWeightKg).toBe(100);
    expect(reason).toMatch(/\+1 rep/);
  });

  it('adds weight and resets reps once the ceiling is cleared on all sets', () => {
    const { state: next, reason } = advance(
      dp,
      state({ currentReps: 12 }),
      sets(3, 12),
      3,
    );
    expect(next.currentWeightKg).toBe(102.5);
    expect(next.currentReps).toBe(8);
    expect(reason).toMatch(/cleared 12 reps/);
  });

  it('repeats when the rep target is missed', () => {
    const { state: next, reason } = advance(
      dp,
      state({ currentReps: 10 }),
      sets(3, 9),
      3,
    );
    expect(next.currentReps).toBe(10);
    expect(next.currentWeightKg).toBe(100);
    expect(reason).toMatch(/Repeat/);
  });
});
