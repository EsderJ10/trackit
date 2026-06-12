import { describe, expect, it } from 'vitest';

import { computePRs, estimateOneRepMax } from './progression';

describe('estimateOneRepMax', () => {
  it('returns the bare weight for a single rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('applies the Epley formula for multiple reps', () => {
    // 100 · (1 + 5/30) = 116.66…
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.667, 2);
  });

  it('treats non-positive reps as the bare weight', () => {
    expect(estimateOneRepMax(80, 0)).toBe(80);
  });
});

describe('computePRs', () => {
  it('returns null with no history', () => {
    expect(computePRs([])).toBeNull();
  });

  it('finds the heaviest set and best estimated 1RM', () => {
    const prs = computePRs([
      { reps: 5, weight: 100 }, // 1RM ≈ 116.7
      { reps: 1, weight: 110 }, // 1RM = 110, heaviest
      { reps: 8, weight: 95 }, // 1RM ≈ 120.3, best estimate
    ]);
    expect(prs).not.toBeNull();
    expect(prs!.heaviestKg).toBe(110);
    expect(prs!.best1RmKg).toBeCloseTo(120.333, 2);
  });
});
