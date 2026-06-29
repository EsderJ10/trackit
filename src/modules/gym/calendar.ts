// Pure calendar helpers for the history month view. Dates are local-time; weeks
// are Monday-first to match `streak` (whose helpers these build on).

import { dayKey, startOfWeek } from './streak';

/** Local midnight at the start of `d`'s day. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The first day of `d`'s month, at local midnight. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** The first day of the month `n` months from `d` (n may be negative). */
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/**
 * Six Monday-first weeks covering `month` plus leading/trailing fill days. The
 * fixed 6×7 grid keeps height stable; callers dim days outside `month`.
 */
export function monthGrid(month: Date): Date[][] {
  const gridStart = startOfWeek(startOfMonth(month));
  const weeks: Date[][] = [];
  let cursor = gridStart;
  for (let week = 0; week < 6; week++) {
    const row: Date[] = [];
    for (let day = 0; day < 7; day++) {
      row.push(cursor);
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
      );
    }
    weeks.push(row);
  }
  return weeks;
}

/**
 * Map each finished session to its completion day (`dayKey`), collecting the
 * session ids per day so the calendar can mark days and open the right session.
 */
export function groupSessionDays(
  sessions: { id: number; finishedAt: Date | null }[],
): Map<string, number[]> {
  const byDay = new Map<string, number[]>();
  for (const session of sessions) {
    if (!session.finishedAt) continue;
    const key = dayKey(session.finishedAt);
    const existing = byDay.get(key);
    if (existing) existing.push(session.id);
    else byDay.set(key, [session.id]);
  }
  return byDay;
}
