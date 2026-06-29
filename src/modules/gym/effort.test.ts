import { describe, expect, it } from 'vitest';

import {
  effortBounds,
  effortInputValue,
  effortLabel,
  formatEffort,
  fromDisplayEffort,
  parseEffortInput,
  toDisplayEffort,
} from './effort';

describe('effort scale conversion', () => {
  it('passes RPE through unchanged', () => {
    expect(toDisplayEffort(8, 'rpe')).toBe(8);
    expect(fromDisplayEffort(8, 'rpe')).toBe(8);
  });

  it('maps RPE to RIR via 10 − rpe', () => {
    // The canonical identity from the research: RPE 8 == 2 RIR.
    expect(toDisplayEffort(8, 'rir')).toBe(2);
    expect(toDisplayEffort(10, 'rir')).toBe(0);
    expect(toDisplayEffort(1, 'rir')).toBe(9);
  });

  it('round-trips a stored RPE through RIR display and back', () => {
    for (const rpe of [1, 5, 7.5, 9, 10]) {
      const shown = toDisplayEffort(rpe, 'rir');
      expect(fromDisplayEffort(shown, 'rir')).toBe(rpe);
    }
  });

  it('clamps converted RPE to the 1–10 scale', () => {
    // RIR 10 would imply RPE 0 — clamp up to 1.
    expect(fromDisplayEffort(10, 'rir')).toBe(1);
    // RPE entered above 10 clamps down to 10.
    expect(fromDisplayEffort(15, 'rpe')).toBe(10);
    expect(fromDisplayEffort(0, 'rpe')).toBe(1);
  });
});

describe('parseEffortInput', () => {
  it('clears on blank or unparseable input', () => {
    expect(parseEffortInput('', 'rpe')).toBeNull();
    expect(parseEffortInput('   ', 'rir')).toBeNull();
    expect(parseEffortInput('abc', 'rpe')).toBeNull();
  });

  it('parses and converts a RIR entry to canonical RPE', () => {
    expect(parseEffortInput('2', 'rir')).toBe(8);
    expect(parseEffortInput('0', 'rir')).toBe(10);
  });

  it('parses an RPE entry directly', () => {
    expect(parseEffortInput('7.5', 'rpe')).toBe(7.5);
  });
});

describe('effortInputValue', () => {
  it('is empty for a null stored value', () => {
    expect(effortInputValue(null, 'rpe')).toBe('');
    expect(effortInputValue(null, 'rir')).toBe('');
  });

  it('shows the stored RPE in the chosen scale', () => {
    expect(effortInputValue(8, 'rpe')).toBe('8');
    expect(effortInputValue(8, 'rir')).toBe('2');
  });
});

describe('formatEffort', () => {
  it('returns an empty string when no effort was recorded', () => {
    expect(formatEffort(null, 'rpe')).toBe('');
  });

  it('labels the value with the chosen scale', () => {
    expect(formatEffort(8, 'rpe')).toBe('RPE 8');
    expect(formatEffort(8, 'rir')).toBe('RIR 2');
    expect(formatEffort(7.5, 'rpe')).toBe('RPE 7.5');
  });
});

describe('labels and bounds', () => {
  it('labels each scale', () => {
    expect(effortLabel('rpe')).toBe('RPE');
    expect(effortLabel('rir')).toBe('RIR');
  });

  it('bounds RPE to 1–10 and RIR to 0–9', () => {
    expect(effortBounds('rpe')).toEqual({ min: 1, max: 10 });
    expect(effortBounds('rir')).toEqual({ min: 0, max: 9 });
  });
});
