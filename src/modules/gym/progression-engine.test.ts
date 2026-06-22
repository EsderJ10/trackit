import { describe, expect, it } from 'vitest';

import {
  advance,
  advanceCursor,
  type DpScheme,
  e1rmFromLoggedSet,
  generateWave,
  type LpScheme,
  type ProgramCursor,
  type ProgressionState,
  renderPrescribedSet,
  roundKg,
  rpePct,
  suggestNext,
  type WaveRules,
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

describe('advanceCursor', () => {
  const cursor = (over: Partial<ProgramCursor> = {}): ProgramCursor => ({
    currentWeek: 1,
    currentDayIndex: 0,
    currentCycle: 1,
    ...over,
  });

  it('moves to the next day within a week', () => {
    // 3 days, 4 weeks: day 0 → day 1, same week/cycle.
    expect(advanceCursor(cursor(), 3, 4)).toEqual({
      currentWeek: 1,
      currentDayIndex: 1,
      currentCycle: 1,
    });
  });

  it('wraps the last day of a week into the next week', () => {
    expect(advanceCursor(cursor({ currentDayIndex: 2 }), 3, 4)).toEqual({
      currentWeek: 2,
      currentDayIndex: 0,
      currentCycle: 1,
    });
  });

  it('wraps the last day of the last week into the next cycle', () => {
    expect(
      advanceCursor(cursor({ currentWeek: 4, currentDayIndex: 2 }), 3, 4),
    ).toEqual({ currentWeek: 1, currentDayIndex: 0, currentCycle: 2 });
  });

  it('treats a single-week program as a day rotation that bumps the cycle', () => {
    // StrongLifts-style: 1 week, 2 alternating days. Day 1 → day 0, cycle++.
    expect(advanceCursor(cursor({ currentDayIndex: 1 }), 2, 1)).toEqual({
      currentWeek: 1,
      currentDayIndex: 0,
      currentCycle: 2,
    });
  });

  it('clamps degenerate day/week counts to at least one', () => {
    expect(advanceCursor(cursor(), 0, 0)).toEqual({
      currentWeek: 1,
      currentDayIndex: 0,
      currentCycle: 2,
    });
  });
});

describe('rpePct — RPE → %1RM', () => {
  it('is monotonic: harder RPE and fewer reps mean a higher %1RM', () => {
    expect(rpePct(10, 1)).toBeGreaterThan(rpePct(8, 1));
    expect(rpePct(8, 3)).toBeGreaterThan(rpePct(8, 8));
  });

  it('anchors a true single at exactly 1RM (the old Epley-inverse bug)', () => {
    expect(rpePct(10, 1)).toBe(1.0); // was 0.968 — under-loaded a single by 3.2%
    expect(rpePct(8, 8)).toBeLessThan(0.8); // 8 reps @ RPE8 → 10 to failure
  });

  it('matches RTS chart anchors (transcribed grid)', () => {
    expect(rpePct(10, 5)).toBeCloseTo(0.863, 3); // 5RM ≈ 86.3%
    expect(rpePct(10, 10)).toBeCloseTo(0.739, 3); // 10RM ≈ 73.9%
  });

  it('honours the RIR-shift identity: r reps @9 ≈ (r+1) reps @10', () => {
    // RPE 9 = 1 rep in reserve, so it loads like one more rep taken to failure.
    expect(rpePct(9, 3)).toBeCloseTo(rpePct(10, 4), 6);
    expect(rpePct(9, 6)).toBeCloseTo(rpePct(10, 7), 6);
  });

  it('clamps RPE to [1, 10]', () => {
    expect(rpePct(12, 1)).toBe(rpePct(10, 1));
    expect(rpePct(0, 1)).toBe(rpePct(1, 1));
  });
});

describe('renderPrescribedSet', () => {
  const ctx = {
    currentWeightKg: 80,
    trainingMaxKg: 100,
    e1rmKg: 120,
    stepKg: 2.5,
  };

  it('renders a percentage of the training max, rounded to the step', () => {
    // 0.85 × 100 = 85 → loadable already
    expect(
      renderPrescribedSet(
        { reps: 5, intensityKind: 'pct', intensityValue: 0.85, amrap: false },
        ctx,
      ),
    ).toEqual({ reps: 5, weightKg: 85, amrap: false });
    // 0.93 × 100 = 93 → nearest 2.5 = 92.5; AMRAP flag carried through
    expect(
      renderPrescribedSet(
        { reps: 1, intensityKind: 'pct', intensityValue: 0.93, amrap: true },
        ctx,
      ),
    ).toEqual({ reps: 1, weightKg: 92.5, amrap: true });
  });

  it('renders an RPE target from e1RM, rounded to the step', () => {
    const set = renderPrescribedSet(
      { reps: 5, intensityKind: 'rpe', intensityValue: 8, amrap: false },
      ctx,
    );
    expect(set.weightKg).toBe(roundKg(120 * rpePct(8, 5), 2.5));
    expect(set.reps).toBe(5);
  });

  it('renders an absolute load, falling back to the working weight when 0', () => {
    expect(
      renderPrescribedSet(
        { reps: 5, intensityKind: 'abs', intensityValue: 60, amrap: false },
        ctx,
      ).weightKg,
    ).toBe(60);
    expect(
      renderPrescribedSet(
        { reps: 5, intensityKind: 'abs', intensityValue: 0, amrap: false },
        ctx,
      ).weightKg,
    ).toBe(80); // falls back to currentWeightKg
  });

  it('treats a null training max as zero load (unset TM)', () => {
    expect(
      renderPrescribedSet(
        { reps: 5, intensityKind: 'pct', intensityValue: 0.85, amrap: false },
        { ...ctx, trainingMaxKg: null },
      ).weightKg,
    ).toBe(0);
  });
});

describe('e1rmFromLoggedSet — the RPE re-anchor (inverse of the render path)', () => {
  it('holds the anchor flat when the prescription is hit on the nose', () => {
    // Render 5 reps @ RPE8 from a 90 kg anchor, log exactly that, re-anchor.
    const anchor = 90;
    const rendered = 90 * rpePct(8, 5);
    const reanchored = e1rmFromLoggedSet(rendered, 5, 8);
    expect(reanchored).toBeCloseTo(anchor, 6); // no downward spiral
  });

  it('raises the anchor when you beat the prescription', () => {
    const rendered = 90 * rpePct(8, 5);
    // Same load, but it only felt like RPE7 (you had more in the tank).
    expect(e1rmFromLoggedSet(rendered, 5, 7)).toBeGreaterThan(90);
    // Same load and RPE, but you got an extra rep.
    expect(e1rmFromLoggedSet(rendered, 6, 8)).toBeGreaterThan(90);
  });

  it('lowers the anchor when you miss the prescription', () => {
    const rendered = 90 * rpePct(8, 5);
    // Hit the load but it ground to RPE9 — harder than prescribed.
    expect(e1rmFromLoggedSet(rendered, 5, 9)).toBeLessThan(90);
  });
});

describe('generateWave — mesocycle periodization', () => {
  const rules: WaveRules = {
    weekCount: 4,
    setsStart: 3,
    setsEnd: 6,
    reps: 8,
    rirStart: 3,
    rirEnd: 0,
    amrapLastSet: false,
    deload: { sets: 2, reps: 8, rir: 4 },
  };

  it('ramps set count from MEV to MRV across the hard weeks', () => {
    const wave = generateWave(rules);
    const setsInWeek = (w: number) =>
      wave.filter((s) => s.weekIndex === w).length;
    expect(setsInWeek(1)).toBe(3); // MEV
    expect(setsInWeek(4)).toBe(6); // MRV
    expect(setsInWeek(1)).toBeLessThan(setsInWeek(4));
  });

  it('descends RIR (climbs RPE) week to week', () => {
    const wave = generateWave(rules);
    const rpeInWeek = (w: number) =>
      wave.find((s) => s.weekIndex === w)?.intensityValue ?? 0;
    expect(rpeInWeek(1)).toBe(7); // RIR 3 → RPE 7
    expect(rpeInWeek(4)).toBe(10); // RIR 0 → RPE 10
    expect(rpeInWeek(1)).toBeLessThan(rpeInWeek(4));
  });

  it('appends a lighter deload week after the hard weeks', () => {
    const wave = generateWave(rules);
    const deload = wave.filter((s) => s.weekIndex === 5);
    expect(deload).toHaveLength(2);
    expect(deload[0]?.intensityValue).toBe(6); // RIR 4 → RPE 6
  });

  it('every cell is an rpe prescription on 0.5 steps', () => {
    for (const s of generateWave(rules)) {
      expect(s.intensityKind).toBe('rpe');
      expect((s.intensityValue * 2) % 1).toBe(0);
    }
  });
});
