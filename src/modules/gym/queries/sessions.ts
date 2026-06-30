import {
  and,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  isNull,
  ne,
  sql,
} from 'drizzle-orm';
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
import type { MeasurementKind, SetType } from '../schema';

import { advanceProgram, rollbackSessionProgression } from './programs';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Start a freestyle (or routine-based) session. `startedAt` (ms) backdates it
 * for logging a past-day workout — `finishWorkout` then completes it on that day
 * so it lands on its calendar date.
 */
export function startWorkout(routineId?: number, startedAt?: number): number {
  // Atomic: the session row and all its pre-filled set rows commit together.
  return db.transaction(() => {
    const result = db
      .insert(workoutSessions)
      .values({
        routineId: routineId ?? null,
        ...(startedAt != null ? { startedAt: new Date(startedAt) } : {}),
      })
      .run();
    const sessionId = result.lastInsertRowId;

    // Pre-fill each routine exercise's planned sets, seeded from last performance
    // (falling back to the routine target); rows are incomplete until checked off.
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
 * Insert planned (incomplete) set rows for an exercise, seeded from last
 * performance, falling back to the given target. Returns the rows seeded.
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

interface SessionContext {
  routineId: number | null;
  programId: number | null;
  programDayId: number | null;
}

/**
 * The id of the most recent prior finished session containing this exercise. When
 * `context` is given, the match is scoped to the same routine (or program day);
 * `context` undefined searches chronologically across everything. A program/
 * routine `context` with no routine and no program (freestyle) returns undefined,
 * so the caller falls back to the unscoped search.
 */
function findLastSessionId(
  exerciseId: number,
  excludeSessionId: number,
  context?: SessionContext,
): number | undefined {
  const conditions = [
    eq(setLogs.exerciseId, exerciseId),
    // Working sets only — never pre-fill a warmup as the work set.
    eq(setLogs.setType, 'working'),
    isNotNull(setLogs.completedAt),
    // Finished sessions only, not an abandoned in-progress one.
    isNotNull(workoutSessions.finishedAt),
    ne(workoutSessions.id, excludeSessionId),
  ];
  if (context !== undefined) {
    if (context.routineId != null) {
      conditions.push(eq(workoutSessions.routineId, context.routineId));
    } else if (context.programId != null && context.programDayId != null) {
      conditions.push(eq(workoutSessions.programId, context.programId));
      conditions.push(eq(workoutSessions.programDayId, context.programDayId));
    } else {
      return undefined; // freestyle session → nothing to scope to.
    }
  }
  const rows = db
    .select({ sessionId: setLogs.sessionId })
    .from(setLogs)
    .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
    .where(and(...conditions))
    .orderBy(desc(setLogs.completedAt))
    .limit(1)
    .all();
  return rows[0]?.sessionId;
}

/**
 * The completed working sets (reps + weight, in order) to surface as "previous".
 * Scoped to the session being logged: prefer the last time this exercise was done
 * in the SAME routine / program day (so a Push-day lift never shows a Pull-day
 * number), falling back to the chronologically latest. Empty when no history.
 */
export function getLastPerformance(
  exerciseId: number,
  excludeSessionId: number,
): { reps: number; weight: number }[] {
  const context = db
    .select({
      routineId: workoutSessions.routineId,
      programId: workoutSessions.programId,
      programDayId: workoutSessions.programDayId,
    })
    .from(workoutSessions)
    .where(eq(workoutSessions.id, excludeSessionId))
    .all()[0];

  const lastSessionId =
    (context != null
      ? findLastSessionId(exerciseId, excludeSessionId, context)
      : undefined) ?? findLastSessionId(exerciseId, excludeSessionId);
  if (lastSessionId == null) return [];

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
 * The catalog's most-recently-logged exercises (full rows), newest use first —
 * the "Recent" shortcut atop the exercise picker. Reuses the
 * `exercise + set type + completed` index.
 */
export function useRecentExercises(limit = 8) {
  return useLiveQuery(
    db
      .select(getTableColumns(exercises))
      .from(exercises)
      .innerJoin(setLogs, eq(setLogs.exerciseId, exercises.id))
      .where(isNotNull(setLogs.completedAt))
      .groupBy(exercises.id)
      .orderBy(desc(sql`max(${setLogs.completedAt})`))
      .limit(limit),
    [limit],
  );
}

/**
 * An exercise's all-time bests for live PR detection — folded from working sets
 * in finished sessions (the in-progress session has no `finishedAt`, so it's
 * excluded). Plain read, once per exercise on load; the screen folds new sets after.
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

/** Every completed set across all sessions as flat CSV-export rows, newest session first. */
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
  // Non-null in practice (query filters finished sessions); Drizzle keeps the nullable type.
  finishedAt: Date | null;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
}

/** Every completed working set for one exercise across finished sessions, newest first; weights stay canonical kg. */
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
          // Working sets only — PR/e1RM history excludes warmups & drops.
          eq(setLogs.setType, 'working'),
          isNotNull(setLogs.completedAt),
          isNotNull(workoutSessions.finishedAt),
        ),
      )
      .orderBy(desc(workoutSessions.finishedAt), setLogs.setNumber),
    [exerciseId],
  );
}

/** Every completed set across finished sessions with the bits for weekly volume aggregation (bucketed in `analytics`). */
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

// Single source of truth is the schema column; re-exported so consumers keep
// importing these from the query barrel.
export type { MeasurementKind, SetType };

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
      dayIndex: workoutSessions.programDayIndex,
      cycle: workoutSessions.programCycle,
    })
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .all()[0];

  // Idempotent: only the null → finished transition advances progression, so a
  // re-finish can't double-advance the working weight.
  if (session == null || session.finishedAt != null) return;

  // A backdated session completes on its started day so it lands on its calendar
  // date; a normal session finishes now.
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const finishedAt =
    session.startedAt.getTime() < startOfToday ? session.startedAt : now;

  // A program session advances the cursor + folds progression ONLY when it is the
  // cursor's own workout. A back-filled past/skipped day (the cursor already moved
  // past it) is just recorded — re-advancing would double-step the plan and fold
  // its sets into progression out of order. (Legacy null cycle ⇒ match on wk/day.)
  let advancesCursor = false;
  if (session.programId != null && session.programDayId != null) {
    const program = db
      .select({
        currentWeek: programs.currentWeek,
        currentDayIndex: programs.currentDayIndex,
        currentCycle: programs.currentCycle,
      })
      .from(programs)
      .where(eq(programs.id, session.programId))
      .all()[0];
    advancesCursor =
      program != null &&
      session.weekIndex === program.currentWeek &&
      session.dayIndex === program.currentDayIndex &&
      (session.cycle == null || session.cycle === program.currentCycle);
  }

  // Atomic: stamping finishedAt and advancing progression + the program cursor
  // must commit together, or a crash leaves progression half-applied.
  db.transaction(() => {
    db.update(workoutSessions)
      .set({ finishedAt })
      .where(eq(workoutSessions.id, sessionId))
      .run();

    if (
      advancesCursor &&
      session.programId != null &&
      session.programDayId != null
    ) {
      advanceProgram(
        session.programId,
        session.programDayId,
        session.weekIndex ?? 1,
        sessionId,
      );
    }
  });
}

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

/** The most recent in-progress workout (no `finishedAt`), if any. */
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

/**
 * Sync one-shot of the open session — for start guards in event handlers, where a
 * hook can't run. Mirrors `useActiveSession`'s filter; `undefined` if none open.
 */
export function getActiveSession(): ActiveSession | undefined {
  return db
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
    .limit(1)
    .all()[0];
}

/**
 * Delete a session and its set logs — discards an abandoned/in-progress workout
 * or removes a finished one from history. If the session advanced a program's
 * progression (and is still the latest to have done so), that advancement is
 * reversed first, in the same transaction. Explicit set-log delete (not just FK
 * cascade) so it holds regardless of the connection's `foreign_keys` pragma.
 *
 * Returns whether progression was rolled back, so the UI can confirm what happened.
 */
export function deleteSession(sessionId: number): boolean {
  return db.transaction(() => {
    const rolledBack = rollbackSessionProgression(sessionId);
    db.delete(setLogs).where(eq(setLogs.sessionId, sessionId)).run();
    db.delete(workoutSessions).where(eq(workoutSessions.id, sessionId)).run();
    return rolledBack;
  });
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
  // Rolling 7-day window aggregated in SQL: only load-bearing kinds
  // (weight_reps/bodyweight) contribute tonnage, warmups excluded, cutoff via
  // SQLite `unixepoch()` (no wall-clock dep, never ships full history to JS). A
  // GROUP BY-less aggregate always returns exactly one row.
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

/** Lifetime / gamification stats for the profile screen (aggregated in the pure `aggregateProfileStats`). */
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
      // Intentional read of current time for the rolling window + streak.
      // eslint-disable-next-line react-hooks/purity
      aggregateProfileStats(sets, finished, Date.now()),
    [sets, finished],
  );
}

/** Per-exercise personal records, ranked by best estimated 1RM (finished sessions only). */
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
          // Only working sets of load×reps lifts yield a 1RM PR.
          eq(setLogs.setType, 'working'),
          eq(exercises.measurementKind, 'weight_reps'),
          isNotNull(setLogs.completedAt),
          isNotNull(workoutSessions.finishedAt),
        ),
      ),
  );

  return useMemo(() => rankExercisePRs(data, limit), [data, limit]);
}
