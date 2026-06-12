import { describe, expect, it } from 'vitest';

import { fromDisplayWeight, toDisplayWeight } from './units';

describe('toDisplayWeight', () => {
  it('returns kg unchanged in kg mode', () => {
    expect(toDisplayWeight(100, 'kg')).toBe(100);
    expect(toDisplayWeight(42.5, 'kg')).toBe(42.5);
  });

  it('converts kg to lb and rounds to one decimal', () => {
    expect(toDisplayWeight(100, 'lb')).toBe(220.5);
    expect(toDisplayWeight(60, 'lb')).toBe(132.3);
    expect(toDisplayWeight(0, 'lb')).toBe(0);
  });
});

describe('fromDisplayWeight', () => {
  it('returns value unchanged in kg mode', () => {
    expect(fromDisplayWeight(100, 'kg')).toBe(100);
  });

  it('converts an lb entry back to kg', () => {
    expect(fromDisplayWeight(220.5, 'lb')).toBeCloseTo(100, 1);
  });
});

describe('round trip', () => {
  it('is exact for kg', () => {
    for (const kg of [0, 20, 60, 100, 142.5]) {
      expect(fromDisplayWeight(toDisplayWeight(kg, 'kg'), 'kg')).toBe(kg);
    }
  });

  it('stays within rounding tolerance for lb', () => {
    for (const kg of [20, 60, 100]) {
      const back = fromDisplayWeight(toDisplayWeight(kg, 'lb'), 'lb');
      expect(back).toBeCloseTo(kg, 0);
    }
  });
});
