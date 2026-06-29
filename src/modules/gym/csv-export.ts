// CSV export of workout history — spreadsheet-friendly, for interop/analysis
// (the restore-able backup is the core JSON one, not this).

export interface CsvSetRow {
  /** Session finish time (ms epoch) or null if unfinished. */
  finishedAt: number | null;
  exerciseName: string;
  setNumber: number;
  setType: string;
  reps: number;
  /** Canonical kg. */
  weightKg: number;
  rpe: number | null;
  durationSec: number | null;
  distanceM: number | null;
}

const HEADER = [
  'date',
  'exercise',
  'set',
  'type',
  'reps',
  'weight_kg',
  'rpe',
  'duration_sec',
  'distance_m',
] as const;

/** Quote a field iff it contains a comma, quote, or newline (RFC 4180). */
function escapeField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function isoDate(ms: number | null): string {
  if (ms == null) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function cell(value: string | number | null): string {
  if (value == null) return '';
  return escapeField(String(value));
}

/** Serialize logged sets to CSV (header + one row per set). Does not sort; emits the header even when empty. */
export function toWorkoutCsv(rows: CsvSetRow[]): string {
  const lines = [HEADER.join(',')];
  for (const r of rows) {
    lines.push(
      [
        cell(isoDate(r.finishedAt)),
        cell(r.exerciseName),
        cell(r.setNumber),
        cell(r.setType),
        cell(r.reps),
        cell(r.weightKg),
        cell(r.rpe),
        cell(r.durationSec),
        cell(r.distanceM),
      ].join(','),
    );
  }
  return lines.join('\n');
}
