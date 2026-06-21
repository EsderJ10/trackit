import { describe, expect, it } from 'vitest';

import {
  classifyVolume,
  DEFAULT_MUSCLE_LANDMARKS,
  type MuscleLandmarkBands,
} from './landmarks';

describe('classifyVolume', () => {
  // Mirrors the verified RP chest row: MV 4, MEV 6, MAV 16, MRV 24.
  const chest: MuscleLandmarkBands = { mv: 4, mev: 6, mav: 16, mrv: 24 };

  it('flags volume below maintenance', () => {
    expect(classifyVolume(0, chest)).toBe('below-mv');
    expect(classifyVolume(3, chest)).toBe('below-mv');
  });

  it('treats MV..MEV as maintenance', () => {
    expect(classifyVolume(4, chest)).toBe('maintenance'); // exactly MV
    expect(classifyVolume(5, chest)).toBe('maintenance');
  });

  it('treats MEV..MAV as productive (MEV inclusive)', () => {
    expect(classifyVolume(6, chest)).toBe('productive'); // exactly MEV
    expect(classifyVolume(10, chest)).toBe('productive');
    expect(classifyVolume(15, chest)).toBe('productive');
  });

  it('treats MAV..MRV as maximal (both bounds inclusive)', () => {
    expect(classifyVolume(16, chest)).toBe('maximal'); // exactly MAV
    expect(classifyVolume(20, chest)).toBe('maximal');
    expect(classifyVolume(24, chest)).toBe('maximal'); // exactly MRV
  });

  it('flags volume above MRV as overreaching', () => {
    expect(classifyVolume(25, chest)).toBe('overreaching');
    expect(classifyVolume(40, chest)).toBe('overreaching');
  });

  it('handles a muscle with MV 0 (e.g. core, worked indirectly)', () => {
    // With MV 0, a single set is at/above maintenance — never 'below-mv'.
    const core: MuscleLandmarkBands = { mv: 0, mev: 6, mav: 16, mrv: 25 };
    expect(classifyVolume(1, core)).toBe('maintenance');
    expect(classifyVolume(6, core)).toBe('productive');
  });

  it('keeps every default band strictly ascending (MV ≤ MEV ≤ MAV ≤ MRV)', () => {
    for (const [muscle, b] of Object.entries(DEFAULT_MUSCLE_LANDMARKS)) {
      expect(b.mv, muscle).toBeLessThanOrEqual(b.mev);
      expect(b.mev, muscle).toBeLessThanOrEqual(b.mav);
      expect(b.mav, muscle).toBeLessThanOrEqual(b.mrv);
    }
  });
});
