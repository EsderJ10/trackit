import { describe, expect, it } from 'vitest';

import {
  type SessionLabelFields,
  sessionLabel,
  sessionLabelLine,
} from './session-label';

const base: SessionLabelFields = {
  routineName: null,
  programName: null,
  programDayName: null,
  programWeekIndex: null,
  programLengthWeeks: null,
};

describe('sessionLabel', () => {
  it('names a program session by its day + "Week X of Y"', () => {
    const label = sessionLabel({
      ...base,
      programName: '5-Day PPLUL',
      programDayName: 'Push',
      programWeekIndex: 2,
      programLengthWeeks: 6,
    });
    expect(label).toEqual({ title: 'Push', subtitle: 'Week 2 of 6' });
  });

  it('falls back to the program name when the day name is missing', () => {
    const label = sessionLabel({
      ...base,
      programName: '5-Day PPLUL',
      programDayName: null,
      programWeekIndex: 1,
      programLengthWeeks: 6,
    });
    expect(label.title).toBe('5-Day PPLUL');
    expect(label.subtitle).toBe('Week 1 of 6');
  });

  it('omits the subtitle when week/length are absent', () => {
    const label = sessionLabel({
      ...base,
      programName: 'Custom',
      programDayName: 'Day A',
    });
    expect(label).toEqual({ title: 'Day A', subtitle: undefined });
  });

  it('prefers the program over a routine when both are present', () => {
    const label = sessionLabel({
      ...base,
      routineName: 'Old routine',
      programName: 'PPLUL',
      programDayName: 'Legs',
      programWeekIndex: 3,
      programLengthWeeks: 6,
    });
    expect(label.title).toBe('Legs');
  });

  it('names a routine session by its routine name', () => {
    const label = sessionLabel({ ...base, routineName: 'Upper A' });
    expect(label).toEqual({ title: 'Upper A', subtitle: undefined });
  });

  it('labels an ad-hoc session "Freestyle"', () => {
    expect(sessionLabel(base)).toEqual({
      title: 'Freestyle',
      subtitle: undefined,
    });
  });
});

describe('sessionLabelLine', () => {
  it('joins title and subtitle for a program session', () => {
    expect(
      sessionLabelLine({
        ...base,
        programName: 'PPLUL',
        programDayName: 'Pull',
        programWeekIndex: 4,
        programLengthWeeks: 6,
      }),
    ).toBe('Pull · Week 4 of 6');
  });

  it('returns just the title when there is no subtitle', () => {
    expect(sessionLabelLine({ ...base, routineName: 'Upper A' })).toBe(
      'Upper A',
    );
    expect(sessionLabelLine(base)).toBe('Freestyle');
  });
});
