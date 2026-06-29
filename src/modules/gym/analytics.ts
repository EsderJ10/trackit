// Pure progress-analytics: completed set logs → weekly trend series for the
// Progress screen. Weights stay canonical kg; the screen converts at render.

import { gatedOneRepMax } from './progression';
import type { MeasurementKind, SetType } from './queries';
import { nextWeek, startOfWeek } from './streak';

/** A completed set with the bits needed for volume aggregation. */
export interface VolumeSet {
  /** The owning session's finish time, in ms since epoch. */
  finishedAt: number;
  reps: number;
  /** Canonical kg. */
  weight: number;
  setType: SetType;
  measurementKind: MeasurementKind;
  /** The exercise's coarse muscle group — how volume landmarks are keyed. */
  muscleGroup: string;
}

/** One point in a weekly series: the week's local-Monday start + its value. */
export interface WeekPoint {
  weekStart: number;
  value: number;
}

/** A working set keyed to its session, for the strength (e1RM) trend. */
export interface StrengthSet {
  sessionId: number;
  /** Session finish time, in ms since epoch. */
  finishedAt: number;
  reps: number;
  weight: number;
}

/** Only loaded kinds carry tonnage; timed/distance work has no weight. */
const LOAD_BEARING: ReadonlySet<MeasurementKind> = new Set([
  'weight_reps',
  'bodyweight',
]);

/** A set is hard volume unless it's a warm-up (drops/failures still count). */
function isHardSet(set: VolumeSet): boolean {
  return set.setType !== 'warmup';
}

// One point per calendar week, first in-range week with data → now, zero-filling
// empties so the x-axis stays proportional to time.
function weeklySeries(
  sets: VolumeSet[],
  fromMs: number,
  nowMs: number,
  contribution: (set: VolumeSet) => number,
): WeekPoint[] {
  const inRange = sets.filter(
    (set) => set.finishedAt >= fromMs && set.finishedAt <= nowMs,
  );
  if (inRange.length === 0) return [];

  const byWeek = new Map<number, number>();
  let earliest = Number.POSITIVE_INFINITY;
  for (const set of inRange) {
    const week = startOfWeek(new Date(set.finishedAt)).getTime();
    byWeek.set(week, (byWeek.get(week) ?? 0) + contribution(set));
    if (week < earliest) earliest = week;
  }

  const lastWeek = startOfWeek(new Date(nowMs)).getTime();
  const points: WeekPoint[] = [];
  let cursor = new Date(earliest);
  while (cursor.getTime() <= lastWeek) {
    const week = cursor.getTime();
    points.push({ weekStart: week, value: Math.round(byWeek.get(week) ?? 0) });
    cursor = nextWeek(cursor);
  }
  return points;
}

/** Weekly tonnage (Σ reps×weight, kg) from hard, load-bearing sets. */
export function weeklyTonnage(
  sets: VolumeSet[],
  fromMs: number,
  nowMs: number,
): WeekPoint[] {
  return weeklySeries(sets, fromMs, nowMs, (set) =>
    isHardSet(set) && LOAD_BEARING.has(set.measurementKind)
      ? set.reps * set.weight
      : 0,
  );
}

/** Weekly hard-set count (non-warm-up completed sets per week). */
export function weeklySetCount(
  sets: VolumeSet[],
  fromMs: number,
  nowMs: number,
): WeekPoint[] {
  return weeklySeries(sets, fromMs, nowMs, (set) => (isHardSet(set) ? 1 : 0));
}

/** Weekly hard-set count for one muscle group (landmark units, sets/week). */
export function weeklySetsByGroup(
  sets: VolumeSet[],
  group: string,
  fromMs: number,
  nowMs: number,
): WeekPoint[] {
  return weeklySetCount(
    sets.filter((set) => set.muscleGroup === group),
    fromMs,
    nowMs,
  );
}

/** Muscle groups trained in range with their total hard-set count, busiest first. */
export function groupsByVolume(
  sets: VolumeSet[],
  fromMs: number,
  nowMs: number,
): { group: string; sets: number }[] {
  const counts = new Map<string, number>();
  for (const set of sets) {
    if (set.finishedAt < fromMs || set.finishedAt > nowMs || !isHardSet(set)) {
      continue;
    }
    counts.set(set.muscleGroup, (counts.get(set.muscleGroup) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([group, total]) => ({ group, sets: total }))
    .sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group));
}

/**
 * Best reliable est. 1RM per session (kg), oldest → newest, from `fromMs`.
 * All-high-rep sessions (no reliable estimate) are dropped, not plotted as zero.
 */
export function e1rmTrend(rows: StrengthSet[], fromMs = 0): number[] {
  const best = new Map<number, { e1rm: number; finishedAt: number }>();
  for (const row of rows) {
    if (row.finishedAt < fromMs) continue;
    const estimate = gatedOneRepMax(row.weight, row.reps);
    if (estimate === null) continue;
    const current = best.get(row.sessionId);
    if (!current || estimate > current.e1rm) {
      best.set(row.sessionId, { e1rm: estimate, finishedAt: row.finishedAt });
    }
  }
  return [...best.values()]
    .sort((a, b) => a.finishedAt - b.finishedAt)
    .map((entry) => Math.round(entry.e1rm * 10) / 10);
}

/** Sum of a weekly series' values (e.g. total tonnage / total sets in range). */
export function seriesTotal(points: WeekPoint[]): number {
  return points.reduce((sum, point) => sum + point.value, 0);
}

/** The largest value in a weekly series (the peak week), or 0 if empty. */
export function seriesPeak(points: WeekPoint[]): number {
  return points.reduce((max, point) => Math.max(max, point.value), 0);
}
