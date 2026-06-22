import { describe, expect, it } from 'vitest';

import {
  detectPRs,
  EMPTY_BESTS,
  type ExerciseBests,
  foldBests,
  prMessage,
} from './pr-detect';

const bests: ExerciseBests = {
  best1RmKg: 100,
  bestWeightKg: 90,
  bestVolumeKg: 400, // e.g. 80 × 5
  bestDurationSec: 60,
};

describe('detectPRs', () => {
  it('fires nothing on the very first set (no prior history)', () => {
    const kinds = detectPRs(
      { reps: 5, weightKg: 100, durationSec: null, measurementKind: 'weight_reps' },
      EMPTY_BESTS,
    );
    expect(kinds).toEqual([]);
  });

  it('detects a heaviest-set and 1RM PR', () => {
    const kinds = detectPRs(
      { reps: 3, weightKg: 95, durationSec: null, measurementKind: 'weight_reps' },
      bests,
    );
    expect(kinds).toContain('weight'); // 95 > 90
    expect(kinds).toContain('1rm'); // 95×(1+3/30)=104.5 > 100
  });

  it('detects a best-volume PR', () => {
    const kinds = detectPRs(
      { reps: 10, weightKg: 50, durationSec: null, measurementKind: 'weight_reps' },
      bests,
    );
    expect(kinds).toContain('volume'); // 500 > 400
  });

  it('ties do not fire (re-logging the same numbers)', () => {
    const kinds = detectPRs(
      { reps: 1, weightKg: 90, durationSec: null, measurementKind: 'weight_reps' },
      bests,
    );
    expect(kinds).not.toContain('weight'); // 90 is not > 90
  });

  it('a timed set sets only a duration PR, never a load PR', () => {
    const kinds = detectPRs(
      { reps: 0, weightKg: 0, durationSec: 90, measurementKind: 'duration' },
      bests,
    );
    expect(kinds).toEqual(['duration']); // 90 > 60, no weight/1rm/volume
  });
});

describe('foldBests', () => {
  it('raises only the beaten bests', () => {
    const next = foldBests(bests, {
      reps: 1,
      weightKg: 95,
      durationSec: null,
      measurementKind: 'weight_reps',
    });
    expect(next.bestWeightKg).toBe(95);
    expect(next.bestDurationSec).toBe(60); // untouched
  });

  it('after folding, the same set no longer PRs', () => {
    const set = {
      reps: 3,
      weightKg: 95,
      durationSec: null,
      measurementKind: 'weight_reps' as const,
    };
    const folded = foldBests(bests, set);
    expect(detectPRs(set, folded)).toEqual([]);
  });
});

describe('prMessage', () => {
  it('labels the primary record', () => {
    expect(prMessage('Bench Press', ['weight'])).toBe(
      'Bench Press · Heaviest set',
    );
  });
});
