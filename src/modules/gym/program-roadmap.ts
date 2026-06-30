// Pure status resolution for the read-only program roadmap: how each week/day
// cell reads. History-aware — "done" means an actual logged session exists; a cell
// the cursor has passed with NO session is a "skipped" gap the user can back-fill.
export type CursorStatus = 'done' | 'current' | 'skipped' | 'upcoming';

export interface RoadmapCursor {
  /** 1-based week the cursor sits in. */
  currentWeek: number;
  /** 0-based day the cursor sits in. */
  currentDayIndex: number;
}

/** Key into the logged-session set: `${weekIndex}:${dayIndex}` (1-based wk, 0-based day). */
export function cellKey(weekIndex: number, dayIndex: number): string {
  return `${weekIndex}:${dayIndex}`;
}

/** Where a week sits relative to the cursor — drives the week-timeline pills. */
export function weekStatus(
  weekIndex: number,
  currentWeek: number,
): CursorStatus {
  if (weekIndex < currentWeek) return 'done';
  if (weekIndex === currentWeek) return 'current';
  return 'upcoming';
}

/**
 * Status of a (weekIndex, dayIndex) cell, given the cursor and the set of cells
 * that have a logged session this cycle (`cellKey` keys). A logged cell is `done`;
 * otherwise position decides: behind the cursor with no session ⇒ `skipped`, the
 * cursor's own cell ⇒ `current`, ahead ⇒ `upcoming`.
 */
export function cellStatus(
  weekIndex: number,
  dayIndex: number,
  cursor: RoadmapCursor,
  logged: ReadonlySet<string>,
): CursorStatus {
  if (logged.has(cellKey(weekIndex, dayIndex))) return 'done';
  if (weekIndex < cursor.currentWeek) return 'skipped';
  if (weekIndex > cursor.currentWeek) return 'upcoming';
  if (dayIndex < cursor.currentDayIndex) return 'skipped';
  if (dayIndex === cursor.currentDayIndex) return 'current';
  return 'upcoming';
}
