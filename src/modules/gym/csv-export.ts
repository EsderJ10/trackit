// CSV export of workout history — a portable, spreadsheet-friendly view of every
// logged set (the full restore-able backup is the core JSON one; this is for
// interop / analysis elsewhere). Pure and unit-tested; the screen gathers rows
// from the DB and shares the string as a file.

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

/** ISO date (YYYY-MM-DD) for a row's timestamp, or empty when unfinished. */
function isoDate(ms: number | null): string {
  if (ms == null) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function cell(value: string | number | null): string {
  if (value == null) return '';
  return escapeField(String(value));
}

/**
 * Serialize logged sets to a CSV string (header + one row per set). Rows should
 * already be ordered (e.g. newest session first); this does not sort. Empty input
 * still emits the header row.
 */
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
