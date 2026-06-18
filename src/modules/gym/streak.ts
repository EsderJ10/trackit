// Pure date/streak helpers for the profile stats. Kept free of DB/native
// imports so they can be unit-tested directly (like `progression-engine`).

/** Local-midnight day key (`YYYY-M-D`) — groups sessions into calendar days. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Local Monday-midnight of the week containing `d` — the streak's week bucket. */
export function startOfWeek(d: Date): Date {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const mondayOffset = (day.getDay() + 6) % 7; // Sun→6 … Mon→0
  day.setDate(day.getDate() - mondayOffset);
  return day;
}

/** The week-bucket one week before `weekStart` (DST-safe via date math). */
export function prevWeek(weekStart: Date): Date {
  const prev = new Date(weekStart);
  prev.setDate(prev.getDate() - 7);
  return prev;
}

/**
 * Consecutive calendar weeks with a logged session, counting back from the
 * current week. An empty current week stays alive (doesn't break the streak),
 * so the streak only resets after a fully missed week.
 *
 * @param loggedWeekStarts `startOfWeek(...).getTime()` for every logged session.
 * @param currentWeekStart `startOfWeek` of today.
 */
export function computeStreakWeeks(
  loggedWeekStarts: Set<number>,
  currentWeekStart: Date,
): number {
  let cursor = currentWeekStart;
  if (!loggedWeekStarts.has(cursor.getTime())) cursor = prevWeek(cursor);
  let streak = 0;
  while (loggedWeekStarts.has(cursor.getTime())) {
    streak += 1;
    cursor = prevWeek(cursor);
  }
  return streak;
}
