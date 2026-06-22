import { describe, expect, it } from 'vitest';

import { warmupSets } from './warmup';

describe('warmupSets', () => {
  it('ramps empty bar → 40/60/80% to a 100 kg work set', () => {
    const sets = warmupSets(100, 20);
    expect(sets).toEqual([
      { reps: 8, weightKg: 20 }, // bar
      { reps: 5, weightKg: 40 },
      { reps: 3, weightKg: 60 },
      { reps: 2, weightKg: 80 },
    ]);
  });

  it('drops rungs at or above the working weight', () => {
    // 30 kg work set off a 20 kg bar: 80% = 24 → rounds to 25 (kept, < 30).
    const sets = warmupSets(30, 20);
    expect(sets.every((s) => s.weightKg < 30)).toBe(true);
    expect(sets.some((s) => s.weightKg === 25)).toBe(true);
  });

  it('returns nothing when the work weight is at/under the bar', () => {
    expect(warmupSets(20, 20)).toEqual([]);
    expect(warmupSets(0, 20)).toEqual([]);
  });
});
