import { and, desc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/core/db/client';

import {
  aggregateProfileStats,
  type GymProfileStats,
  rankExercisePRs,
} from '../profile-stats';
import type { CsvSetRow } from '../csv-export';
import { EMPTY_BESTS, type ExerciseBests, foldBests } from '../pr-detect';
import { sessionLabelLine } from '../session-label';
import {
  exercises,
  programDays,
  programs,
  routineExercises,
  routines,
  setLogs,
  workoutSessions,
} from '../schema';

import { advanceProgram } from './programs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Sessions + set logs
// ---------------------------------------------------------------------------

/**
 * Start a freestyle (or routine-based) session. `startedAt` (ms) backdates it
 * for logging a workout you did on a past day — `finishWorkout` then completes
 * it on that day rather than now, so it lands on its calendar date everywhere.
 */
export function startWorkout(routineId?: number, startedAt?: number): number {
  // Atomic: the session row and all its pre-filled set rows commit together,
  // so a failure can't leave a session with a partial plan.
  return db.transaction(() => {
    const result = db
      .insert(workoutSessions)
      .values({
        routineId: routineId ?? null,
        ...(startedAt != null ? { startedAt: new Date(startedAt) } : {}),
      })
      .run();
    const sessionId = result.lastInsertRowId;

    // Pre-fill each routine exercise with its planned sets, seeded from the last
    // time it was performed (falling back to the routine target). New rows are
    // incomplete (completedAt null) until the user checks them off.
    if (routineId != null) {
      const plan = db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, routineId))
        .orderBy(routineExercises.position)
        .all();

      for (const exercise of plan) {
        seedExerciseSets(sessionId, exercise.exerciseId, {
          sets: exercise.targetSets,
          reps: exercise.targetReps,
          weight: exercise.targetWeight,
        });
      }
    }

    return sessionId;
  });
}

/**
 * Insert planned (incomplete) set rows for an exercise in a session, seeded
 * from the last time it was performed, falling back to the given target.
 * Returns the number of rows seeded.
 */
export function seedExerciseSets(
  sessionId: number,
  exerciseId: number,
  fallback?: { sets: number; reps: number; weight: number | null },
): number {
  const previous = getLastPerformance(exerciseId, sessionId);
  const rows =
    previous.length > 0
      ? previous
      : fallback
        ? Array.from({ length: Math.max(1, fallback.sets) }, () => ({
            reps: fallback.reps,
            weight: fallback.weight ?? 0,
          }))
        : [{ reps: 0, weight: 0 }];

  rows.forEach((row, index) => {
    addSet({
      sessionId,
      exerciseId,
      setNumber: index + 1,
      reps: row.reps,
      weight: row.weight,
    });
  });

  return rows.length;
}

/**
 * The completed sets (reps + weight, in set order) from the most recent prior
 * session that included this exercise. Empty when there is no history. Used to
 * seed a new session and, later, to drive progression calculations.
 */
export function getLastPerformance(
  exerciseId: number,
  excludeSessionId: number,
): { reps: number; weight: number }[] {
  const last = db
    .select({ sessionId: setLogs.sessionId })
    .from(setLogs)
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(
      and(
        eq(setLogs.exerciseId, exerciseId),
        // Seed from working sets only — never pre-fill a warmup as the work set.
        eq(setLogs.setType, 'working'),
        isNotNull(setLogs.completedAt),
        // Only seed from a workout the user actually finished, not an
        // abandoned in-progress session.
        isNotNull(workoutSessions.finishedAt),
      ),
    )
    .orderBy(desc(setLogs.completedAt))
    .limit(1)
    .all();

  const lastSessionId = last[0]?.sessionId;
  if (lastSessionId == null || lastSessionId === excludeSessionId) return [];

  return db
    .select({ reps: setLogs.reps, weight: setLogs.weight })
    .from(setLogs)
    .where(
      and(
        eq(setLogs.sessionId, lastSessionId),
        eq(setLogs.exerciseId, exerciseId),
        eq(setLogs.setType, 'working'),
        isNotNull(setLogs.completedAt),
      ),
    )
    .orderBy(setLogs.setNumber)
    .all();
}

/**
 * An exercise's all-time bests for live PR detection — folded from working sets
 * in *finished* sessions (the current in-progress session has no `finishedAt`,
 * so it's excluded for free). Plain read, called once per exercise on session
 * load; the screen folds new sets in-memory after that.
 */
export function getExerciseBests(exerciseId: number): ExerciseBests {
  const rows = db
    .select({
      reps: setLogs.reps,
      weight: setLogs.weight,
      durationSec: setLogs.durationSec,
      measurementKind: exercises.measurementKind,
    })
    .from(setLogs)
    .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id))
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(
      and(
        eq(setLogs.exerciseId, exerciseId),
        eq(setLogs.setType, 'working'),
        isNotNull(setLogs.completedAt),
        isNotNull(workoutSessions.finishedAt),
      ),
    )
    .all();

  return rows.reduce(
    (bests, r) =>
      foldBests(bests, {
        reps: r.reps,
        weightKg: r.weight,
        durationSec: r.durationSec,
        measurementKind: r.measurementKind,
      }),
    EMPTY_BESTS,
  );
}

/**
 * Every completed set across all sessions as flat rows for a CSV export — newest
 * session first. Plain read (no live query); the settings panel serializes via
 * `toWorkoutCsv` and shares the file.
 */
export function getWorkoutCsvRows(): CsvSetRow[] {
  return db
    .select({
      finishedAt: workoutSessions.finishedAt,
      exerciseName: exercises.name,
      setNumber: setLogs.setNumber,
      setType: setLogs.setType,
      reps: setLogs.reps,
      weightKg: setLogs.weight,
      rpe: setLogs.rpe,
      durationSec: setLogs.durationSec,
      distanceM: setLogs.distanceM,
    })
    .from(setLogs)
    .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id))
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(isNotNull(setLogs.completedAt))
    .orderBy(desc(workoutSessions.finishedAt), setLogs.id)
    .all()
    .map((r) => ({ ...r, finishedAt: r.finishedAt?.getTime() ?? null }));
}

export interface ExerciseHistoryRow {
  setId: number;
  sessionId: number;
  // Non-null in practice (the query filters finished sessions) but Drizzle's
  // inferred type keeps the column's nullability.
  finishedAt: Date | null;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
}

/**
 * Every completed set for one exercise across finished sessions, newest first.
 * Weights stay canonical kg; the progression view converts at render. Grouped
 * into per-session blocks by the screen, and fed to `computePRs`.
 */
export function useExerciseSetHistory(exerciseId: number) {
  return useLiveQuery(
    db
      .select({
        setId: setLogs.id,
        sessionId: setLogs.sessionId,
        finishedAt: workoutSessions.finishedAt,
        setNumber: setLogs.setNumber,
        reps: setLogs.reps,
        weight: setLogs.weight,
        rpe: setLogs.rpe,
      })
      .from(setLogs)
      .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
      .where(
        and(
          eq(setLogs.exerciseId, exerciseId),
          // Working sets only — the PR/e1RM history excludes warmups & drops.
          eq(setLogs.setType, 'working'),
          isNotNull(setLogs.completedAt),
          isNotNull(workoutSessions.finishedAt),
        ),
      )
      .orderBy(desc(workoutSessions.finishedAt), setLogs.setNumber),
    [exerciseId],
  );
}

/**
 * Every completed set across finished sessions, with its session finish time
 * and the bits needed for weekly volume aggregation. Powers the Progress
 * screen's trends; the pure bucketing lives in the unit-tested `analytics`.
 */
export function useVolumeHistory() {
  return useLiveQuery(
    db
      .select({
        finishedAt: workoutSessions.finishedAt,
        reps: setLogs.reps,
        weight: setLogs.weight,
        setType: setLogs.setType,
        measurementKind: exercises.measurementKind,
        muscleGroup: exercises.muscleGroup,
      })
      .from(setLogs)
      .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id))
      .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
      .where(
        and(
          isNotNull(setLogs.completedAt),
          isNotNull(workoutSessions.finishedAt),
        ),
      ),
  );
}

export function useSession(sessionId: number) {
  const { data } = useLiveQuery(
    db.select().from(workoutSessions).where(eq(workoutSessions.id, sessionId)),
    [sessionId],
  );
  return data[0];
}

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';
export type MeasurementKind =
  | 'weight_reps'
  | 'bodyweight'
  | 'duration'
  | 'distance_time';

export interface SetLogRow {
  id: number;
  exerciseId: number;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
  setType: SetType;
  durationSec: number | null;
  distanceM: number | null;
  measurementKind: MeasurementKind;
  completedAt: Date | null;
}

export function useSessionSets(sessionId: number) {
  return useLiveQuery(
    db
      .select({
        id: setLogs.id,
        exerciseId: setLogs.exerciseId,
        exerciseName: exercises.name,
        setNumber: setLogs.setNumber,
        reps: setLogs.reps,
        weight: setLogs.weight,
        rpe: setLogs.rpe,
        setType: setLogs.setType,
        durationSec: setLogs.durationSec,
        distanceM: setLogs.distanceM,
        measurementKind: exercises.measurementKind,
        completedAt: setLogs.completedAt,
      })
      .from(setLogs)
      .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id))
      .where(eq(setLogs.sessionId, sessionId))
      // Order by id (insertion order) — completedAt is null for planned sets.
      // Unfiltered by setType: the active workout shows every set, warmups too.
      .orderBy(setLogs.id),
    [sessionId],
  );
}

export interface AddSetInput {
  sessionId: number;
  exerciseId: number;
  setNumber: number;
  reps: number;
  weight: number;
  rpe?: number;
}

/** Insert a planned (incomplete) set; returns its id. */
export function addSet(input: AddSetInput): number {
  const result = db
    .insert(setLogs)
    .values({
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      reps: input.reps,
      weight: input.weight,
      rpe: input.rpe ?? null,
      completedAt: null,
    })
    .run();
  return result.lastInsertRowId;
}

export interface SetPatch {
  reps?: number;
  weight?: number;
  /** RPE 1–10 (half-steps allowed); null clears it. */
  rpe?: number | null;
  setType?: SetType;
  /** Seconds of timed work (duration / distance_time kinds); null clears it. */
  durationSec?: number | null;
  /** Metres of distance work (distance_time kind); null clears it. */
  distanceM?: number | null;
}

/** Insert warm-up sets (planned, `setType: 'warmup'`) for an exercise. */
export function addWarmupSets(
  sessionId: number,
  exerciseId: number,
  sets: { reps: number; weightKg: number }[],
): void {
  if (sets.length === 0) return;
  db.transaction((tx) => {
    sets.forEach((set, index) => {
      tx.insert(setLogs)
        .values({
          sessionId,
          exerciseId,
          setNumber: index + 1,
          reps: set.reps,
          weight: set.weightKg,
          setType: 'warmup',
          completedAt: null,
        })
        .run();
    });
  });
}

export function updateSet(id: number, patch: SetPatch): void {
  db.update(setLogs).set(patch).where(eq(setLogs.id, id)).run();
}

/** Mark a set complete (stamps completedAt) or revert it to planned (null). */
export function setSetCompleted(id: number, completed: boolean): void {
  db.update(setLogs)
    .set({ completedAt: completed ? new Date() : null })
    .where(eq(setLogs.id, id))
    .run();
}

export function deleteSetLog(id: number): void {
  db.delete(setLogs).where(eq(setLogs.id, id)).run();
}

/** Remove every set for one exercise in a session (used to drop the exercise). */
export function deleteExerciseSets(
  sessionId: number,
  exerciseId: number,
): void {
  db.delete(setLogs)
    .where(
      and(eq(setLogs.sessionId, sessionId), eq(setLogs.exerciseId, exerciseId)),
    )
    .run();
}

export function updateSessionNotes(sessionId: number, notes: string): void {
  db.update(workoutSessions)
    .set({ notes: notes.trim() === '' ? null : notes })
    .where(eq(workoutSessions.id, sessionId))
    .run();
}

export function finishWorkout(sessionId: number): void {
  const session = db
    .select({
      finishedAt: workoutSessions.finishedAt,
      startedAt: workoutSessions.startedAt,
      programId: workoutSessions.programId,
      programDayId: workoutSessions.programDayId,
      weekIndex: workoutSessions.programWeekIndex,
    })
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .all()[0];

  // Idempotent: only the null → finished transition advances progression, so a
  // re-finish can't double-advance the working weight.
  if (session == null || session.finishedAt != null) return;

  // A backdated session (started on an earlier day) completes on that day so it
  // lands on its calendar date in history; a normal session finishes now.
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const finishedAt =
    session.startedAt.getTime() < startOfToday ? session.startedAt : now;

  // Atomic: stamping finishedAt and advancing every exercise's progression
  // state + the program cursor must commit together. A crash mid-advance must
  // not leave the session finished with progression half-applied.
  db.transaction(() => {
    db.update(workoutSessions)
      .set({ finishedAt })
      .where(eq(workoutSessions.id, sessionId))
      .run();

    if (session.programId != null && session.programDayId != null) {
      advanceProgram(
        session.programId,
        session.programDayId,
        session.weekIndex ?? 1,
        sessionId,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// History + dashboard stats
// ---------------------------------------------------------------------------

export interface SessionSummary {
  id: number;
  routineName: string | null;
  programName: string | null;
  programDayName: string | null;
  programWeekIndex: number | null;
  programLengthWeeks: number | null;
  startedAt: Date;
  finishedAt: Date | null;
  notes: string | null;
}

export function useFinishedSessions() {
  return useLiveQuery(
    db
      .select({
        id: workoutSessions.id,
        routineName: routines.name,
        programName: programs.name,
        programDayName: programDays.name,
        programWeekIndex: workoutSessions.programWeekIndex,
        programLengthWeeks: programs.lengthWeeks,
        startedAt: workoutSessions.startedAt,
        finishedAt: workoutSessions.finishedAt,
        notes: workoutSessions.notes,
      })
      .from(workoutSessions)
      .leftJoin(routines, eq(workoutSessions.routineId, routines.id))
      .leftJoin(programs, eq(workoutSessions.programId, programs.id))
      .leftJoin(programDays, eq(workoutSessions.programDayId, programDays.id))
      .where(isNotNull(workoutSessions.finishedAt))
      .orderBy(desc(workoutSessions.finishedAt)),
  );
}

export interface ActiveSession {
  id: number;
  routineName: string | null;
  programName: string | null;
  programDayName: string | null;
  programWeekIndex: number | null;
  programLengthWeeks: number | null;
  startedAt: Date;
}

/**
 * The most recent in-progress workout (no `finishedAt`), if any. Powers the
 * resume-aware "Start / Resume workout" hero on Home and Train.
 */
export function useActiveSession(): ActiveSession | undefined {
  const { data } = useLiveQuery(
    db
      .select({
        id: workoutSessions.id,
        routineName: routines.name,
        programName: programs.name,
        programDayName: programDays.name,
        programWeekIndex: workoutSessions.programWeekIndex,
        programLengthWeeks: programs.lengthWeeks,
        startedAt: workoutSessions.startedAt,
      })
      .from(workoutSessions)
      .leftJoin(routines, eq(workoutSessions.routineId, routines.id))
      .leftJoin(programs, eq(workoutSessions.programId, programs.id))
      .leftJoin(programDays, eq(workoutSessions.programDayId, programDays.id))
      .where(isNull(workoutSessions.finishedAt))
      .orderBy(desc(workoutSessions.startedAt))
      .limit(1),
  );
  return data[0];
}

/** One finished (or in-progress) session with its program/routine label, for detail. */
export function useSessionSummary(sessionId: number) {
  const { data } = useLiveQuery(
    db
      .select({
        id: workoutSessions.id,
        routineName: routines.name,
        programName: programs.name,
        // Carried so the detail screen can deep-link to the parent program.
        programId: workoutSessions.programId,
        programDayName: programDays.name,
        programWeekIndex: workoutSessions.programWeekIndex,
        programLengthWeeks: programs.lengthWeeks,
        startedAt: workoutSessions.startedAt,
        finishedAt: workoutSessions.finishedAt,
        notes: workoutSessions.notes,
      })
      .from(workoutSessions)
      .leftJoin(routines, eq(workoutSessions.routineId, routines.id))
      .leftJoin(programs, eq(workoutSessions.programId, programs.id))
      .leftJoin(programDays, eq(workoutSessions.programDayId, programDays.id))
      .where(eq(workoutSessions.id, sessionId)),
    [sessionId],
  );
  return data[0];
}

export interface GymStats {
  weeklyVolume: number;
  weeklySets: number;
  lastWorkout: { name: string; finishedAt: Date } | null;
}

export function useGymStats(): GymStats {
  // Aggregate the rolling 7-day window in SQL: only load-bearing kinds
  // (weight_reps/bodyweight) contribute tonnage, warmups are excluded, and the
  // cutoff is evaluated by SQLite (`unixepoch()`) so the query carries no
  // wall-clock dependency and never ships the full set-log history to JS. An
  // aggregate with no GROUP BY always returns exactly one row.
  const { data: weekly } = useLiveQuery(
    db
      .select({
        weeklySets: sql<number>`count(*)`,
        weeklyVolume: sql<number>`coalesce(sum(case when ${exercises.measurementKind} in ('weight_reps', 'bodyweight') then ${setLogs.weight} * ${setLogs.reps} else 0 end), 0)`,
      })
      .from(setLogs)
      .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id))
      .where(
        and(
          isNotNull(setLogs.completedAt),
          ne(setLogs.setType, 'warmup'),
          sql`${setLogs.completedAt} >= (unixepoch() * 1000 - ${WEEK_MS})`,
        ),
      ),
  );
  const { data: lastSessions } = useLiveQuery(
    db
      .select({
        routineName: routines.name,
        programName: programs.name,
        programDayName: programDays.name,
        programWeekIndex: workoutSessions.programWeekIndex,
        programLengthWeeks: programs.lengthWeeks,
        finishedAt: workoutSessions.finishedAt,
      })
      .from(workoutSessions)
      .leftJoin(routines, eq(workoutSessions.routineId, routines.id))
      .leftJoin(programs, eq(workoutSessions.programId, programs.id))
      .leftJoin(programDays, eq(workoutSessions.programDayId, programDays.id))
      .where(isNotNull(workoutSessions.finishedAt))
      .orderBy(desc(workoutSessions.finishedAt))
      .limit(1),
  );

  return useMemo<GymStats>(() => {
    const agg = weekly[0];
    const last = lastSessions[0];
    return {
      weeklyVolume: Math.round(agg?.weeklyVolume ?? 0),
      weeklySets: agg?.weeklySets ?? 0,
      lastWorkout:
        last && last.finishedAt
          ? {
              name: sessionLabelLine(last),
              finishedAt: last.finishedAt,
            }
          : null,
    };
  }, [weekly, lastSessions]);
}

export type {
  ExercisePrRow,
  GymProfileStats,
  MuscleGroupCount,
} from '../profile-stats';

/**
 * Lifetime / gamification stats for the profile screen. Lifetime totals count
 * completed sets (the dashboard's weekly view uses the same rule); workouts,
 * the streak, and the calendar derive from finished sessions. The aggregation
 * itself lives in the pure, unit-tested `aggregateProfileStats`.
 */
export function useGymProfileStats(): GymProfileStats {
  const { data: sets } = useLiveQuery(
    db
      .select({
        weight: setLogs.weight,
        reps: setLogs.reps,
        completedAt: setLogs.completedAt,
        muscleGroup: exercises.muscleGroup,
        setType: setLogs.setType,
        measurementKind: exercises.measurementKind,
      })
      .from(setLogs)
      .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id)),
  );
  const { data: finished } = useLiveQuery(
    db
      .select({ finishedAt: workoutSessions.finishedAt })
      .from(workoutSessions)
      .where(isNotNull(workoutSessions.finishedAt)),
  );

  return useMemo<GymProfileStats>(
    () =>
      // Intentional read of the current time for the rolling window + streak;
      // the memo recomputes when the data changes, which is when it matters.
      // eslint-disable-next-line react-hooks/purity
      aggregateProfileStats(sets, finished, Date.now()),
    [sets, finished],
  );
}

/**
 * Per-exercise personal records, ranked by best estimated 1RM. Mirrors the
 * exercise-history filter (completed sets in finished sessions) so an
 * in-progress set can't masquerade as a record.
 */
export function useExercisePRs(limit = 5) {
  const { data } = useLiveQuery(
    db
      .select({
        exerciseId: setLogs.exerciseId,
        exerciseName: exercises.name,
        reps: setLogs.reps,
        weight: setLogs.weight,
      })
      .from(setLogs)
      .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id))
      .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
      .where(
        and(
          // Only working sets of load×reps lifts yield a 1RM PR — never a
          // warmup, a drop set, or a timed/bodyweight exercise.
          eq(setLogs.setType, 'working'),
          eq(exercises.measurementKind, 'weight_reps'),
          isNotNull(setLogs.completedAt),
          isNotNull(workoutSessions.finishedAt),
        ),
      ),
  );

  return useMemo(() => rankExercisePRs(data, limit), [data, limit]);
}
