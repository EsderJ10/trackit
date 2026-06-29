// Pure aggregation for the profile screen — lifetime totals, muscle breakdown,
// streaks, and personal-record ranking. DB/native-free so it is unit-tested
// directly (see `profile-stats.test.ts`); the `queries` hooks feed it live rows.

import { computePRs } from './progression';
import {
  computeLongestStreak,
  computeStreakWeeks,
  startOfWeek,
} from './streak';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ProfileSetRow {
  weight: number;
  reps: number;
  /** Null for planned (incomplete) sets — they don't count toward stats. */
  completedAt: Date | null;
  muscleGroup: string;
  /** Defaults to 'working' when absent; 'warmup' sets are excluded from stats. */
  setType?: 'warmup' | 'working' | 'drop' | 'failure';
  /** Defaults to 'weight_reps'; only load-bearing kinds add tonnage. */
  measurementKind?: 'weight_reps' | 'bodyweight' | 'duration' | 'distance_time';
}

export interface ProfileSessionRow {
  finishedAt: Date | null;
}

export interface MuscleGroupCount {
  muscleGroup: string;
  sets: number;
}

export interface GymProfileStats {
  /** Finished sessions, all time. */
  totalWorkouts: number;
  /** Finished sessions in the current calendar week — feeds the goal ring. */
  thisWeekWorkouts: number;
  /** Completed sets, all time. */
  totalSets: number;
  /** Completed reps, all time. */
  totalReps: number;
  /** Completed volume (canonical kg), all time — convert at render. */
  totalVolume: number;
  /** Consecutive calendar weeks with ≥1 finished session, the current week alive. */
  streakWeeks: number;
  /** Longest run of consecutive logged weeks, all time (personal best). */
  longestStreakWeeks: number;
  /** Completed-set count per muscle group over the last 7 days, ranked. */
  muscleBreakdown: MuscleGroupCount[];
}

/**
 * Fold completed sets + finished sessions into the profile's stats. `now` is
 * passed in (not read here) so the function stays pure and testable.
 */
export function aggregateProfileStats(
  sets: ProfileSetRow[],
  finished: ProfileSessionRow[],
  now: number,
): GymProfileStats {
  const cutoff = now - WEEK_MS;

  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  const muscle = new Map<string, number>();
  for (const s of sets) {
    if (s.completedAt == null) continue; // planned sets don't count.
    if (s.setType === 'warmup') continue; // warmups aren't training volume.
    totalSets += 1;
    totalReps += s.reps;
    // Timed/distance work carries no load — count the set, not phantom tonnage.
    const kind = s.measurementKind ?? 'weight_reps';
    if (kind === 'weight_reps' || kind === 'bodyweight') {
      totalVolume += s.weight * s.reps;
    }
    if (s.completedAt.getTime() >= cutoff) {
      muscle.set(s.muscleGroup, (muscle.get(s.muscleGroup) ?? 0) + 1);
    }
  }
  const muscleBreakdown = [...muscle.entries()]
    .map(([muscleGroup, count]) => ({ muscleGroup, sets: count }))
    .sort((a, b) => b.sets - a.sets);

  const currentWeek = startOfWeek(new Date(now)).getTime();
  const loggedWeeks = new Set<number>();
  let thisWeekWorkouts = 0;
  for (const f of finished) {
    if (f.finishedAt == null) continue;
    const week = startOfWeek(f.finishedAt).getTime();
    loggedWeeks.add(week);
    if (week === currentWeek) thisWeekWorkouts += 1;
  }

  return {
    totalWorkouts: finished.length,
    thisWeekWorkouts,
    totalSets,
    totalReps,
    totalVolume: Math.round(totalVolume),
    streakWeeks: computeStreakWeeks(loggedWeeks, startOfWeek(new Date(now))),
    longestStreakWeeks: computeLongestStreak(loggedWeeks),
    muscleBreakdown,
  };
}

export interface ExercisePrInput {
  exerciseId: number;
  exerciseName: string;
  reps: number;
  weight: number;
}

export interface ExercisePrRow {
  exerciseId: number;
  exerciseName: string;
  /** Heaviest single set, in kg. */
  heaviestKg: number;
  /** Best estimated 1RM across all sets, in kg. */
  best1RmKg: number;
}

/**
 * Per-exercise PRs ranked by best estimated 1RM (then heaviest, then name),
 * capped at `limit`. Callers must pass only completed sets from finished
 * sessions, or an in-progress set could masquerade as a record.
 */
export function rankExercisePRs(
  rows: ExercisePrInput[],
  limit = 5,
): ExercisePrRow[] {
  const byExercise = new Map<
    number,
    { name: string; sets: { reps: number; weight: number }[] }
  >();
  for (const r of rows) {
    let entry = byExercise.get(r.exerciseId);
    if (!entry) {
      entry = { name: r.exerciseName, sets: [] };
      byExercise.set(r.exerciseId, entry);
    }
    entry.sets.push({ reps: r.reps, weight: r.weight });
  }

  const ranked: ExercisePrRow[] = [];
  for (const [exerciseId, { name, sets }] of byExercise) {
    const prs = computePRs(sets);
    if (prs == null) continue;
    ranked.push({
      exerciseId,
      exerciseName: name,
      heaviestKg: prs.heaviestKg,
      best1RmKg: prs.best1RmKg,
    });
  }
  ranked.sort(
    (a, b) =>
      b.best1RmKg - a.best1RmKg ||
      b.heaviestKg - a.heaviestKg ||
      a.exerciseName.localeCompare(b.exerciseName),
  );
  return ranked.slice(0, limit);
}
