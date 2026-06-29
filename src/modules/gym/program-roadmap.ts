// Pure cursor resolution for the read-only program roadmap: how each week/day
// cell reads relative to the cursor (currentWeek 1-based + currentDayIndex 0-based).
export type CursorStatus = 'done' | 'current' | 'upcoming';

export interface RoadmapCursor {
  /** 1-based week the cursor sits in. */
  currentWeek: number;
  /** 0-based day the cursor sits in. */
  currentDayIndex: number;
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
 * Where a (weekIndex, dayIndex) cell sits relative to the cursor. Weeks decide
 * first; only within the *current* week does the day decide done/current/upcoming.
 */
export function cellStatus(
  weekIndex: number,
  dayIndex: number,
  cursor: RoadmapCursor,
): CursorStatus {
  if (weekIndex < cursor.currentWeek) return 'done';
  if (weekIndex > cursor.currentWeek) return 'upcoming';
  if (dayIndex < cursor.currentDayIndex) return 'done';
  if (dayIndex === cursor.currentDayIndex) return 'current';
  return 'upcoming';
}
