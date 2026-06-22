import { describe, expect, it } from 'vitest';

import {
  type DashboardLayoutEntry,
  moveEntry,
  parseDashboardLayout,
  reconcileLayout,
  serializeDashboardLayout,
  toggleHidden,
} from './layout';

describe('parseDashboardLayout', () => {
  it('returns [] for null/empty/garbage', () => {
    expect(parseDashboardLayout(null)).toEqual([]);
    expect(parseDashboardLayout('')).toEqual([]);
    expect(parseDashboardLayout('not json')).toEqual([]);
    expect(parseDashboardLayout('{"not":"array"}')).toEqual([]);
  });

  it('keeps well-formed entries and coerces hidden to boolean', () => {
    expect(
      parseDashboardLayout('[{"moduleId":"gym","hidden":true},{"moduleId":"x"}]'),
    ).toEqual([
      { moduleId: 'gym', hidden: true },
      { moduleId: 'x', hidden: false },
    ]);
  });

  it('skips items without a string moduleId', () => {
    expect(
      parseDashboardLayout('[{"hidden":true},{"moduleId":42},{"moduleId":"ok"}]'),
    ).toEqual([{ moduleId: 'ok', hidden: false }]);
  });
});

describe('reconcileLayout', () => {
  it('appends newly-registered modules as visible in registry order', () => {
    const stored: DashboardLayoutEntry[] = [{ moduleId: 'gym', hidden: true }];
    expect(reconcileLayout(stored, ['gym', 'finance', 'habits'])).toEqual([
      { moduleId: 'gym', hidden: true },
      { moduleId: 'finance', hidden: false },
      { moduleId: 'habits', hidden: false },
    ]);
  });

  it('drops entries for modules that no longer exist', () => {
    const stored: DashboardLayoutEntry[] = [
      { moduleId: 'old', hidden: false },
      { moduleId: 'gym', hidden: false },
    ];
    expect(reconcileLayout(stored, ['gym'])).toEqual([
      { moduleId: 'gym', hidden: false },
    ]);
  });

  it('preserves stored order over registry order and dedupes', () => {
    const stored: DashboardLayoutEntry[] = [
      { moduleId: 'habits', hidden: false },
      { moduleId: 'gym', hidden: false },
      { moduleId: 'gym', hidden: true }, // duplicate ignored
    ];
    expect(reconcileLayout(stored, ['gym', 'habits'])).toEqual([
      { moduleId: 'habits', hidden: false },
      { moduleId: 'gym', hidden: false },
    ]);
  });

  it('round-trips through serialize → parse → reconcile', () => {
    const entries: DashboardLayoutEntry[] = [
      { moduleId: 'gym', hidden: true },
      { moduleId: 'finance', hidden: false },
    ];
    const restored = reconcileLayout(
      parseDashboardLayout(serializeDashboardLayout(entries)),
      ['gym', 'finance'],
    );
    expect(restored).toEqual(entries);
  });
});

describe('toggleHidden', () => {
  it('flips only the matching module and is immutable', () => {
    const entries: DashboardLayoutEntry[] = [
      { moduleId: 'gym', hidden: false },
      { moduleId: 'finance', hidden: false },
    ];
    const next = toggleHidden(entries, 'gym');
    expect(next).toEqual([
      { moduleId: 'gym', hidden: true },
      { moduleId: 'finance', hidden: false },
    ]);
    expect(entries[0]?.hidden).toBe(false); // original untouched
  });
});

describe('moveEntry', () => {
  const entries: DashboardLayoutEntry[] = [
    { moduleId: 'a', hidden: false },
    { moduleId: 'b', hidden: false },
    { moduleId: 'c', hidden: false },
  ];

  it('moves down and up', () => {
    expect(moveEntry(entries, 0, 1).map((e) => e.moduleId)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(moveEntry(entries, 2, -1).map((e) => e.moduleId)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('is a no-op past either end', () => {
    expect(moveEntry(entries, 0, -1).map((e) => e.moduleId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(moveEntry(entries, 2, 1).map((e) => e.moduleId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
