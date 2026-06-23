import { describe, expect, it } from 'vitest';

import { platesPerSide, summarisePlates } from './plate-math';

describe('platesPerSide (kg)', () => {
  it('loads an exact 100 kg off a 20 kg bar', () => {
    const plan = platesPerSide(100, 20);
    expect(plan.exact).toBe(true);
    expect(plan.achieved).toBe(100);
    // 40 kg per side → 25 + 15
    expect(plan.plates).toEqual([25, 15]);
  });

  it('returns just the bar at bar weight', () => {
    const plan = platesPerSide(20, 20);
    expect(plan.plates).toEqual([]);
    expect(plan.exact).toBe(true);
  });

  it('handles fractional plates without stranding (62.5 kg)', () => {
    const plan = platesPerSide(62.5, 20);
    // 21.25 per side → 20 + 1.25
    expect(plan.plates).toEqual([20, 1.25]);
    expect(plan.achieved).toBe(62.5);
    expect(plan.exact).toBe(true);
  });

  it('falls back to the closest achievable below target', () => {
    // 21 kg total off a 20 kg bar = 0.5/side, below the smallest 1.25 plate.
    const plan = platesPerSide(21, 20);
    expect(plan.exact).toBe(false);
    expect(plan.achieved).toBe(20);
  });
});

describe('summarisePlates', () => {
  it('groups repeated plates largest-first', () => {
    expect(summarisePlates([25, 25, 10, 5, 5, 5])).toEqual([
      { plate: 25, count: 2 },
      { plate: 10, count: 1 },
      { plate: 5, count: 3 },
    ]);
  });
});
