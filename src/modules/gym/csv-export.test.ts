import { describe, expect, it } from 'vitest';

import { type CsvSetRow, toWorkoutCsv } from './csv-export';

const row: CsvSetRow = {
  finishedAt: Date.UTC(2026, 5, 22, 10, 0, 0),
  exerciseName: 'Bench Press (Barbell)',
  setNumber: 1,
  setType: 'working',
  reps: 5,
  weightKg: 100,
  rpe: 8,
  durationSec: null,
  distanceM: null,
};

describe('toWorkoutCsv', () => {
  it('emits a header even with no rows', () => {
    expect(toWorkoutCsv([])).toBe(
      'date,exercise,set,type,reps,weight_kg,rpe,duration_sec,distance_m',
    );
  });

  it('writes one line per set with an ISO date and blank nulls', () => {
    const csv = toWorkoutCsv([row]);
    const [, line] = csv.split('\n');
    expect(line).toBe('2026-06-22,Bench Press (Barbell),1,working,5,100,8,,');
  });

  it('quotes fields containing commas', () => {
    const csv = toWorkoutCsv([
      { ...row, exerciseName: 'Row, Cable', rpe: null },
    ]);
    expect(csv.split('\n')[1]).toContain('"Row, Cable"');
  });
});
