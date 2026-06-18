import { describe, expect, it } from 'vitest';

import { compareToPrevious } from './set-comparison';

describe('compareToPrevious', () => {
  it('is "same" for an identical set', () => {
    expect(
      compareToPrevious({ reps: 5, weightKg: 80 }, { reps: 5, weightKg: 80 }),
    ).toBe('same');
  });

  it('is "up" when heavier at equal reps', () => {
    expect(
      compareToPrevious({ reps: 5, weightKg: 82.5 }, { reps: 5, weightKg: 80 }),
    ).toBe('up');
  });

  it('is "up" when more reps at equal weight', () => {
    expect(
      compareToPrevious({ reps: 6, weightKg: 80 }, { reps: 5, weightKg: 80 }),
    ).toBe('up');
  });

  it('is "down" when fewer reps at equal weight', () => {
    expect(
      compareToPrevious({ reps: 4, weightKg: 80 }, { reps: 5, weightKg: 80 }),
    ).toBe('down');
  });

  it('ranks heavier-fewer above lighter-more by estimated 1RM', () => {
    // 82.5 · (1 + 3/30) = 90.75  vs  80 · (1 + 5/30) = 93.33 → down.
    expect(
      compareToPrevious({ reps: 3, weightKg: 82.5 }, { reps: 5, weightKg: 80 }),
    ).toBe('down');
  });
});
