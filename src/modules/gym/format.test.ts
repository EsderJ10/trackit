import { describe, expect, it } from 'vitest';

import { formatRelativeDate, formatWeight } from './format';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('formatWeight', () => {
  it('trims integer values', () => {
    expect(formatWeight(100, 'kg')).toBe('100 kg');
  });

  it('keeps one decimal for non-integer values', () => {
    expect(formatWeight(42.5, 'kg')).toBe('42.5 kg');
  });

  it('converts canonical kg to the lb display unit', () => {
    expect(formatWeight(100, 'lb')).toBe('220.5 lb');
  });
});

describe('formatRelativeDate', () => {
  it('labels the current day', () => {
    expect(formatRelativeDate(new Date())).toBe('Today');
  });

  it('labels yesterday', () => {
    expect(formatRelativeDate(new Date(Date.now() - DAY_MS))).toBe('Yesterday');
  });

  it('labels a day within the past week', () => {
    expect(formatRelativeDate(new Date(Date.now() - 3 * DAY_MS))).toBe(
      '3 days ago',
    );
  });
});
