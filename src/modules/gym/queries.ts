import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/core/db/client';

import {
  aggregateProfileStats,
  type GymProfileStats,
  rankExercisePRs,
} from './profile-stats';
import {
  advance,
  advanceCursor,
  e1rmFromLoggedSet,
  type ProgressionScheme,
  renderPrescribedSet,
  suggestNext,
} from './progression-engine';
import { DEFAULT_MUSCLE_LANDMARKS, type MuscleLandmarkBands } from './landmarks';
import {
  exercises,
  exerciseTrainingState,
  gymSettings,
  muscleLandmarks,
  programDays,
  programExercises,
  programs,
  programSets,
  programWeeks,
  routineExercises,
  routines,
  setLogs,
  workoutSessions,
} from './schema';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

export function useRoutines() {
  return useLiveQuery(
    db.select().from(routines).orderBy(desc(routines.createdAt)),
  );
}

export function useRoutine(routineId: number) {
  const { data } = useLiveQuery(
    db.select().from(routines).where(eq(routines.id, routineId)),
    [routineId],
  );
  return data[0];
}

export interface RoutineExerciseRow {
  id: number;
  position: number;
  targetSets: number;
  targetReps: number;
  targetWeight: number | null;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
}

export function useRoutineExercises(routineId: number) {
  return useLiveQuery(
    db
      .select({
        id: routineExercises.id,
        position: routineExercises.position,
        targetSets: routineExercises.targetSets,
        targetReps: routineExercises.targetReps,
        targetWeight: routineExercises.targetWeight,
        exerciseId: exercises.id,
        exerciseName: exercises.name,
        muscleGroup: exercises.muscleGroup,
      })
      .from(routineExercises)
      .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
      .where(eq(routineExercises.routineId, routineId))
      .orderBy(routineExercises.position),
    [routineId],
  );
}

export function createRoutine(name: string, description?: string): number {
  const result = db.insert(routines).values({ name, description }).run();
  return result.lastInsertRowId;
}

export function renameRoutine(routineId: number, name: string): void {
  db.update(routines).set({ name }).where(eq(routines.id, routineId)).run();
}

export function deleteRoutine(routineId: number): void {
  db.delete(routines).where(eq(routines.id, routineId)).run();
}

export function addExerciseToRoutine(
  routineId: number,
  exerciseId: number,
): void {
  const existing = db
    .select({ id: routineExercises.id })
    .from(routineExercises)
    .where(eq(routineExercises.routineId, routineId))
    .all();
  db.insert(routineExercises)
    .values({ routineId, exerciseId, position: existing.length })
    .run();
}

export function updateRoutineExercise(
  id: number,
  patch: Partial<{
    targetSets: number;
    targetReps: number;
    targetWeight: number | null;
  }>,
): void {
  db.update(routineExercises)
    .set(patch)
    .where(eq(routineExercises.id, id))
    .run();
}

export function removeRoutineExercise(id: number): void {
  db.delete(routineExercises).where(eq(routineExercises.id, id)).run();
}

// ---------------------------------------------------------------------------
// Gym settings (single row, id = 1)
// ---------------------------------------------------------------------------

const DEFAULT_REST_SEC = 120;

/**
 * The persisted default rest length, in seconds. A plain sync read (used to
 * hydrate the rest-timer store on workout start); falls back to the default when
 * no row exists yet, so no singleton-row bootstrap is required.
 */
export function getDefaultRestSec(): number {
  const row = db
    .select({ defaultRestSec: gymSettings.defaultRestSec })
    .from(gymSettings)
    .where(eq(gymSettings.id, 1))
    .all()[0];
  return row?.defaultRestSec ?? DEFAULT_REST_SEC;
}

/** Persist the default rest length; upserts so the row is created on first write. */
export function setDefaultRestSec(defaultRestSec: number): void {
  db.insert(gymSettings)
    .values({ id: 1, defaultRestSec })
    .onConflictDoUpdate({ target: gymSettings.id, set: { defaultRestSec } })
    .run();
}

/** Live default rest length (seconds); falls back to the default pre-write. */
export function useDefaultRestSec(): number {
  const { data } = useLiveQuery(
    db
      .select({ defaultRestSec: gymSettings.defaultRestSec })
      .from(gymSettings)
      .where(eq(gymSettings.id, 1)),
  );
  return data[0]?.defaultRestSec ?? DEFAULT_REST_SEC;
}

const DEFAULT_WEEKLY_GOAL = 3;

/** Live target finished-workouts-per-week; falls back to the default pre-write. */
export function useWeeklyGoal(): number {
  const { data } = useLiveQuery(
    db
      .select({ weeklyWorkoutGoal: gymSettings.weeklyWorkoutGoal })
      .from(gymSettings)
      .where(eq(gymSettings.id, 1)),
  );
  return data[0]?.weeklyWorkoutGoal ?? DEFAULT_WEEKLY_GOAL;
}

/** Persist the weekly workout goal; upserts so the row is created on first write. */
export function setWeeklyGoal(weeklyWorkoutGoal: number): void {
  db.insert(gymSettings)
    .values({ id: 1, weeklyWorkoutGoal })
    .onConflictDoUpdate({ target: gymSettings.id, set: { weeklyWorkoutGoal } })
    .run();
}

/**
 * Live per-muscle volume landmarks, keyed by `muscle_group` for O(1) lookup
 * against the profile's muscle breakdown. Empty until the seed runs; callers
 * skip band display for muscles absent from the map (e.g. custom groups).
 */
export function useMuscleLandmarks(): Map<string, MuscleLandmarkBands> {
  const { data } = useLiveQuery(db.select().from(muscleLandmarks));
  return useMemo(
    () =>
      new Map(
        data.map((r) => [
          r.muscleGroup,
          { mv: r.mv, mev: r.mev, mav: r.mav, mrv: r.mrv },
        ]),
      ),
    [data],
  );
}

/** Persist one muscle's edited bands (upsert). Callers pass clamped bands. */
export function setMuscleLandmark(
  muscleGroup: string,
  bands: MuscleLandmarkBands,
): void {
  db.insert(muscleLandmarks)
    .values({ muscleGroup, ...bands })
    .onConflictDoUpdate({
      target: muscleLandmarks.muscleGroup,
      set: { mv: bands.mv, mev: bands.mev, mav: bands.mav, mrv: bands.mrv },
    })
    .run();
}

/** Restore every muscle's bands to the RP-derived defaults (upsert). */
export function resetMuscleLandmarks(): void {
  db.transaction((tx) => {
    for (const [muscleGroup, b] of Object.entries(DEFAULT_MUSCLE_LANDMARKS)) {
      tx.insert(muscleLandmarks)
        .values({ muscleGroup, mv: b.mv, mev: b.mev, mav: b.mav, mrv: b.mrv })
        .onConflictDoUpdate({
          target: muscleLandmarks.muscleGroup,
          set: { mv: b.mv, mev: b.mev, mav: b.mav, mrv: b.mrv },
        })
        .run();
    }
  });
}

// ---------------------------------------------------------------------------
// Exercise catalog
// ---------------------------------------------------------------------------

export function useExercises() {
  return useLiveQuery(
    db.select().from(exercises).orderBy(exercises.muscleGroup, exercises.name),
  );
}

export function useExercise(exerciseId: number) {
  const { data } = useLiveQuery(
    db.select().from(exercises).where(eq(exercises.id, exerciseId)),
    [exerciseId],
  );
  return data[0];
}

export function createExercise(
  name: string,
  muscleGroup: string,
  equipment?: string,
): number {
  const result = db
    .insert(exercises)
    .values({ name, muscleGroup, equipment, isCustom: true })
    .run();
  return result.lastInsertRowId;
}

// ---------------------------------------------------------------------------
// Sessions + set logs
// ---------------------------------------------------------------------------

export function startWorkout(routineId?: number): number {
  const result = db
    .insert(workoutSessions)
    .values({ routineId: routineId ?? null })
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
        isNotNull(setLogs.completedAt),
      ),
    )
    .orderBy(setLogs.setNumber)
    .all();
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
          isNotNull(setLogs.completedAt),
          isNotNull(workoutSessions.finishedAt),
        ),
      )
      .orderBy(desc(workoutSessions.finishedAt), setLogs.setNumber),
    [exerciseId],
  );
}

export function useSession(sessionId: number) {
  const { data } = useLiveQuery(
    db.select().from(workoutSessions).where(eq(workoutSessions.id, sessionId)),
    [sessionId],
  );
  return data[0];
}

export interface SetLogRow {
  id: number;
  exerciseId: number;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
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
        completedAt: setLogs.completedAt,
      })
      .from(setLogs)
      .innerJoin(exercises, eq(setLogs.exerciseId, exercises.id))
      .where(eq(setLogs.sessionId, sessionId))
      // Order by id (insertion order) — completedAt is null for planned sets.
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

  db.update(workoutSessions)
    .set({ finishedAt: new Date() })
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
}

export function deleteSession(sessionId: number): void {
  db.delete(workoutSessions).where(eq(workoutSessions.id, sessionId)).run();
}

// ---------------------------------------------------------------------------
// History + dashboard stats
// ---------------------------------------------------------------------------

export interface SessionSummary {
  id: number;
  routineName: string | null;
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
        startedAt: workoutSessions.startedAt,
        finishedAt: workoutSessions.finishedAt,
        notes: workoutSessions.notes,
      })
      .from(workoutSessions)
      .leftJoin(routines, eq(workoutSessions.routineId, routines.id))
      .where(isNotNull(workoutSessions.finishedAt))
      .orderBy(desc(workoutSessions.finishedAt)),
  );
}

export interface ActiveSession {
  id: number;
  routineName: string | null;
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
        startedAt: workoutSessions.startedAt,
      })
      .from(workoutSessions)
      .leftJoin(routines, eq(workoutSessions.routineId, routines.id))
      .where(isNull(workoutSessions.finishedAt))
      .orderBy(desc(workoutSessions.startedAt))
      .limit(1),
  );
  return data[0];
}

/** One finished (or in-progress) session with its routine name, for detail. */
export function useSessionSummary(sessionId: number) {
  const { data } = useLiveQuery(
    db
      .select({
        id: workoutSessions.id,
        routineName: routines.name,
        startedAt: workoutSessions.startedAt,
        finishedAt: workoutSessions.finishedAt,
        notes: workoutSessions.notes,
      })
      .from(workoutSessions)
      .leftJoin(routines, eq(workoutSessions.routineId, routines.id))
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
  const { data: sets } = useLiveQuery(
    db
      .select({
        weight: setLogs.weight,
        reps: setLogs.reps,
        completedAt: setLogs.completedAt,
      })
      .from(setLogs),
  );
  const { data: lastSessions } = useLiveQuery(
    db
      .select({
        routineName: routines.name,
        finishedAt: workoutSessions.finishedAt,
      })
      .from(workoutSessions)
      .leftJoin(routines, eq(workoutSessions.routineId, routines.id))
      .where(isNotNull(workoutSessions.finishedAt))
      .orderBy(desc(workoutSessions.finishedAt))
      .limit(1),
  );

  return useMemo<GymStats>(() => {
    // Intentional read of the current time for the rolling 7-day window; the
    // memo recomputes when `sets` change, which is when this value matters.
    // eslint-disable-next-line react-hooks/purity
    const cutoff = Date.now() - WEEK_MS;
    // Only completed sets count toward volume; planned sets have null completedAt.
    const weekly = sets.filter(
      (s) => s.completedAt != null && s.completedAt.getTime() >= cutoff,
    );
    const weeklyVolume = weekly.reduce((sum, s) => sum + s.weight * s.reps, 0);
    const last = lastSessions[0];
    return {
      weeklyVolume: Math.round(weeklyVolume),
      weeklySets: weekly.length,
      lastWorkout:
        last && last.finishedAt
          ? {
              name: last.routineName ?? 'Freestyle',
              finishedAt: last.finishedAt,
            }
          : null,
    };
  }, [sets, lastSessions]);
}

export type {
  ExercisePrRow,
  GymProfileStats,
  MuscleGroupCount,
} from './profile-stats';

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
          isNotNull(setLogs.completedAt),
          isNotNull(workoutSessions.finishedAt),
        ),
      ),
  );

  return useMemo(() => rankExercisePRs(data, limit), [data, limit]);
}

// ---------------------------------------------------------------------------
// Programs + progression (M5)
//
// A program is a roadmap, not a flat list: it owns DAYS (the split) and WEEKS
// (the periodization), and a cursor (`currentWeek` + `currentDayIndex`) walks
// the lifter through the week × day grid, advancing on each finished session.
// Each exercise drives the next session's suggested sets (`suggestNext`) and
// advances its own per-slot state (`advance`) when a session is finished. State
// is keyed per program-exercise slot, so a lift may appear on more than one day.
// The decision logic lives in the unit-tested `progression-engine`; everything
// here is mechanical glue.
// ---------------------------------------------------------------------------

export function useActivePrograms() {
  return useLiveQuery(
    db
      .select()
      .from(programs)
      .where(eq(programs.active, true))
      .orderBy(desc(programs.createdAt)),
  );
}

export function useProgram(programId: number) {
  const { data } = useLiveQuery(
    db.select().from(programs).where(eq(programs.id, programId)),
    [programId],
  );
  return data[0];
}

/** Every program's days (id, index, name) — for rendering each program's cursor. */
export function useAllProgramDays() {
  return useLiveQuery(
    db
      .select({
        programId: programDays.programId,
        dayIndex: programDays.dayIndex,
        name: programDays.name,
      })
      .from(programDays)
      .orderBy(programDays.programId, programDays.dayIndex),
  );
}

// --- Days ----------------------------------------------------------------

export interface ProgramDayRow {
  id: number;
  dayIndex: number;
  name: string;
}

export function useProgramDays(programId: number) {
  return useLiveQuery(
    db
      .select({
        id: programDays.id,
        dayIndex: programDays.dayIndex,
        name: programDays.name,
      })
      .from(programDays)
      .where(eq(programDays.programId, programId))
      .orderBy(programDays.dayIndex),
    [programId],
  );
}

/** Append a day at the next index; returns the new day id. */
export function addProgramDay(programId: number, name?: string): number {
  const siblings = db
    .select({ id: programDays.id })
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .all();
  const dayIndex = siblings.length;
  const result = db
    .insert(programDays)
    .values({ programId, dayIndex, name: name ?? `Day ${dayIndex + 1}` })
    .run();
  return result.lastInsertRowId;
}

export function renameProgramDay(dayId: number, name: string): void {
  db.update(programDays)
    .set({ name: name.trim() || 'Day' })
    .where(eq(programDays.id, dayId))
    .run();
}

/** Remove a day (its exercises + their state/sets cascade) and reindex the rest. */
export function removeProgramDay(programId: number, dayId: number): void {
  db.transaction((tx) => {
    tx.delete(programDays).where(eq(programDays.id, dayId)).run();
    const remaining = tx
      .select({ id: programDays.id })
      .from(programDays)
      .where(eq(programDays.programId, programId))
      .orderBy(programDays.dayIndex)
      .all();
    remaining.forEach((row, index) => {
      tx.update(programDays)
        .set({ dayIndex: index })
        .where(eq(programDays.id, row.id))
        .run();
    });
  });
}

// --- Weeks ---------------------------------------------------------------

export interface ProgramWeekRow {
  id: number;
  weekIndex: number;
  name: string | null;
  isDeload: boolean;
}

export function useProgramWeeks(programId: number) {
  return useLiveQuery(
    db
      .select({
        id: programWeeks.id,
        weekIndex: programWeeks.weekIndex,
        name: programWeeks.name,
        isDeload: programWeeks.isDeload,
      })
      .from(programWeeks)
      .where(eq(programWeeks.programId, programId))
      .orderBy(programWeeks.weekIndex),
    [programId],
  );
}

/** Append a week at the next index and keep `programs.lengthWeeks` in sync. */
export function addProgramWeek(programId: number, name?: string): number {
  return db.transaction((tx) => {
    const siblings = tx
      .select({ id: programWeeks.id })
      .from(programWeeks)
      .where(eq(programWeeks.programId, programId))
      .all();
    const weekIndex = siblings.length + 1;
    const result = tx
      .insert(programWeeks)
      .values({ programId, weekIndex, name: name ?? `Week ${weekIndex}` })
      .run();
    tx.update(programs)
      .set({ lengthWeeks: weekIndex })
      .where(eq(programs.id, programId))
      .run();
    return result.lastInsertRowId;
  });
}

export function setProgramWeekDeload(weekId: number, isDeload: boolean): void {
  db.update(programWeeks)
    .set({ isDeload })
    .where(eq(programWeeks.id, weekId))
    .run();
}

export function renameProgramWeek(weekId: number, name: string): void {
  db.update(programWeeks)
    .set({ name: name.trim() || null })
    .where(eq(programWeeks.id, weekId))
    .run();
}

// --- Program lifecycle ---------------------------------------------------

/** Create a program seeded with one week and one day so it's usable at once. */
export function createProgram(name: string, description?: string): number {
  return db.transaction((tx) => {
    const result = tx.insert(programs).values({ name, description }).run();
    const programId = result.lastInsertRowId;
    tx.insert(programWeeks)
      .values({ programId, weekIndex: 1, name: 'Week 1' })
      .run();
    tx.insert(programDays)
      .values({ programId, dayIndex: 0, name: 'Day 1' })
      .run();
    return programId;
  });
}

export function renameProgram(programId: number, name: string): void {
  db.update(programs).set({ name }).where(eq(programs.id, programId)).run();
}

export function deleteProgram(programId: number): void {
  // `workout_sessions.program_id` was added via ALTER (migration 0005), so
  // SQLite dropped its ON DELETE clause — clear the references ourselves so
  // history survives. Days/weeks/exercises (and their state/sets) cascade.
  db.transaction((tx) => {
    tx.update(workoutSessions)
      .set({ programId: null, programDayId: null })
      .where(eq(workoutSessions.programId, programId))
      .run();
    tx.delete(programs).where(eq(programs.id, programId)).run();
  });
}

// --- Exercises -----------------------------------------------------------

export interface ProgramExerciseRow {
  id: number;
  programDayId: number;
  dayIndex: number;
  dayName: string;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  position: number;
  schemeType: 'lp' | 'dp' | 'percent' | 'rpe';
  targetSets: number;
  incrementKg: number;
  minReps: number | null;
  maxReps: number | null;
  targetRpe: number | null;
  /** Current working weight (canonical kg) — convert at render. */
  currentWeightKg: number;
  currentReps: number;
  trainingMaxKg: number | null;
  e1rmKg: number | null;
  /** Why the suggestion is what it is; null before the first finished session. */
  lastReason: string | null;
}

const programExerciseSelection = {
  id: programExercises.id,
  programDayId: programExercises.programDayId,
  dayIndex: programDays.dayIndex,
  dayName: programDays.name,
  exerciseId: exercises.id,
  exerciseName: exercises.name,
  muscleGroup: exercises.muscleGroup,
  position: programExercises.position,
  schemeType: programExercises.schemeType,
  targetSets: programExercises.targetSets,
  incrementKg: programExercises.incrementKg,
  minReps: programExercises.minReps,
  maxReps: programExercises.maxReps,
  targetRpe: programExercises.targetRpe,
  currentWeightKg: exerciseTrainingState.currentWeightKg,
  currentReps: exerciseTrainingState.currentReps,
  trainingMaxKg: exerciseTrainingState.trainingMaxKg,
  e1rmKg: exerciseTrainingState.e1rmKg,
  lastReason: exerciseTrainingState.lastReason,
};

/** A program's exercises (all days) joined with their live state, for the editor. */
export function useProgramExercises(programId: number) {
  return useLiveQuery(
    db
      .select(programExerciseSelection)
      .from(programExercises)
      .innerJoin(programDays, eq(programExercises.programDayId, programDays.id))
      .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
      .innerJoin(
        exerciseTrainingState,
        eq(exerciseTrainingState.programExerciseId, programExercises.id),
      )
      .where(eq(programExercises.programId, programId))
      .orderBy(programDays.dayIndex, programExercises.position),
    [programId],
  );
}

/** The exercises for one program day (the active workout's day), with state. */
export function useProgramDayExercises(programDayId: number) {
  return useLiveQuery(
    db
      .select(programExerciseSelection)
      .from(programExercises)
      .innerJoin(programDays, eq(programExercises.programDayId, programDays.id))
      .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
      .innerJoin(
        exerciseTrainingState,
        eq(exerciseTrainingState.programExerciseId, programExercises.id),
      )
      .where(eq(programExercises.programDayId, programDayId))
      .orderBy(programExercises.position),
    [programDayId],
  );
}

export interface AddProgramExerciseInput {
  programId: number;
  programDayId: number;
  exerciseId: number;
  scheme: ProgressionScheme;
  targetSets: number;
  /** Starting working weight (canonical kg). */
  startingWeightKg: number;
  /** Starting rep target — lp keeps its rep target only in state; dp uses minReps. */
  startingReps?: number;
}

/**
 * Add an exercise to a program day with its progression rule and seed its 1:1
 * training-state row. Duplicate lifts are refused within the same day only.
 * Returns the new program-exercise id.
 */
export function addProgramExercise(input: AddProgramExerciseInput): number {
  const { programId, programDayId, exerciseId, scheme, targetSets } = input;

  const daySlots = db
    .select({
      id: programExercises.id,
      exerciseId: programExercises.exerciseId,
    })
    .from(programExercises)
    .where(eq(programExercises.programDayId, programDayId))
    .all();
  const duplicate = daySlots.find((slot) => slot.exerciseId === exerciseId);
  if (duplicate) return duplicate.id;

  return db.transaction((tx) => {
    const inserted = tx
      .insert(programExercises)
      .values({
        programId,
        programDayId,
        exerciseId,
        position: daySlots.length,
        schemeType: scheme.type,
        targetSets,
        incrementKg: scheme.incrementKg,
        minReps: scheme.type === 'dp' ? scheme.minReps : null,
        maxReps: scheme.type === 'dp' ? scheme.maxReps : null,
        failThreshold: scheme.type === 'lp' ? scheme.failThreshold : 3,
        deloadPct: scheme.type === 'lp' ? scheme.deloadPct : 0.1,
      })
      .run();
    const programExerciseId = inserted.lastInsertRowId;

    tx.insert(exerciseTrainingState)
      .values({
        programExerciseId,
        currentWeightKg: input.startingWeightKg,
        currentReps:
          scheme.type === 'dp' ? scheme.minReps : (input.startingReps ?? 5),
        lastReason: 'Starting weight',
      })
      .run();
    return programExerciseId;
  });
}

/** Set a slot's working weight (canonical kg). */
export function setProgramExerciseWeight(
  programExerciseId: number,
  weightKg: number,
): void {
  db.update(exerciseTrainingState)
    .set({ currentWeightKg: weightKg })
    .where(eq(exerciseTrainingState.programExerciseId, programExerciseId))
    .run();
}

/** Set a slot's training max (canonical kg) — percentage schemes. */
export function setProgramExerciseTrainingMax(
  programExerciseId: number,
  trainingMaxKg: number,
): void {
  db.update(exerciseTrainingState)
    .set({ trainingMaxKg })
    .where(eq(exerciseTrainingState.programExerciseId, programExerciseId))
    .run();
}

/** Set a slot's estimated 1RM anchor (canonical kg) — rpe scheme. */
export function setProgramExerciseE1rm(
  programExerciseId: number,
  e1rmKg: number,
): void {
  db.update(exerciseTrainingState)
    .set({ e1rmKg })
    .where(eq(exerciseTrainingState.programExerciseId, programExerciseId))
    .run();
}

/** Remove a program-exercise slot (its state + prescriptions cascade). */
export function removeProgramExercise(programExerciseId: number): void {
  db.delete(programExercises)
    .where(eq(programExercises.id, programExerciseId))
    .run();
}

// --- Per-week prescriptions ---------------------------------------------

export interface ProgramSetRow {
  id: number;
  weekIndex: number;
  setNumber: number;
  reps: number;
  intensityKind: 'abs' | 'pct' | 'rpe';
  intensityValue: number;
  amrap: boolean;
  restSec: number | null;
}

export function useProgramSets(programExerciseId: number) {
  return useLiveQuery(
    db
      .select({
        id: programSets.id,
        weekIndex: programSets.weekIndex,
        setNumber: programSets.setNumber,
        reps: programSets.reps,
        intensityKind: programSets.intensityKind,
        intensityValue: programSets.intensityValue,
        amrap: programSets.amrap,
        restSec: programSets.restSec,
      })
      .from(programSets)
      .where(eq(programSets.programExerciseId, programExerciseId))
      .orderBy(programSets.weekIndex, programSets.setNumber),
    [programExerciseId],
  );
}

export interface UpsertProgramSetInput {
  programExerciseId: number;
  weekIndex: number;
  setNumber: number;
  reps: number;
  intensityKind: 'abs' | 'pct' | 'rpe';
  intensityValue: number;
  amrap?: boolean;
  restSec?: number | null;
}

/** Insert or replace the prescription for one (slot, week, set). */
export function upsertProgramSet(input: UpsertProgramSetInput): void {
  db.transaction((tx) => {
    tx.delete(programSets)
      .where(
        and(
          eq(programSets.programExerciseId, input.programExerciseId),
          eq(programSets.weekIndex, input.weekIndex),
          eq(programSets.setNumber, input.setNumber),
        ),
      )
      .run();
    tx.insert(programSets)
      .values({
        programExerciseId: input.programExerciseId,
        weekIndex: input.weekIndex,
        setNumber: input.setNumber,
        reps: input.reps,
        intensityKind: input.intensityKind,
        intensityValue: input.intensityValue,
        amrap: input.amrap ?? false,
        restSec: input.restSec ?? null,
      })
      .run();
  });
}

export function removeProgramSet(id: number): void {
  db.delete(programSets).where(eq(programSets.id, id)).run();
}

// --- Start a session from the cursor ------------------------------------

/**
 * Start a session from a program's cursor: the current week + day decide which
 * exercises and prescriptions to pre-fill. Each lp/dp slot is rendered from its
 * state via `suggestNext` (percentage/rpe rendering lands in later phases).
 * Returns the new session id.
 */
export function startProgramWorkout(programId: number): number {
  const program = db
    .select({
      currentWeek: programs.currentWeek,
      currentDayIndex: programs.currentDayIndex,
      roundingStepKg: programs.roundingStepKg,
    })
    .from(programs)
    .where(eq(programs.id, programId))
    .all()[0];
  if (program == null) throw new Error(`Program ${programId} not found`);

  const weekIndex = program.currentWeek;
  const day = db
    .select({ id: programDays.id })
    .from(programDays)
    .where(
      and(
        eq(programDays.programId, programId),
        eq(programDays.dayIndex, program.currentDayIndex),
      ),
    )
    .all()[0];

  const result = db
    .insert(workoutSessions)
    .values({
      programId,
      programWeekIndex: weekIndex,
      programDayIndex: program.currentDayIndex,
      programDayId: day?.id ?? null,
    })
    .run();
  const sessionId = result.lastInsertRowId;
  if (day == null) return sessionId;

  const plan = db
    .select({
      programExerciseId: programExercises.id,
      exerciseId: programExercises.exerciseId,
      targetSets: programExercises.targetSets,
      currentWeightKg: exerciseTrainingState.currentWeightKg,
      currentReps: exerciseTrainingState.currentReps,
      successStreak: exerciseTrainingState.successStreak,
      failStreak: exerciseTrainingState.failStreak,
      trainingMaxKg: exerciseTrainingState.trainingMaxKg,
      e1rmKg: exerciseTrainingState.e1rmKg,
    })
    .from(programExercises)
    .innerJoin(
      exerciseTrainingState,
      eq(exerciseTrainingState.programExerciseId, programExercises.id),
    )
    .where(eq(programExercises.programDayId, day.id))
    .orderBy(programExercises.position)
    .all();

  for (const slot of plan) {
    // Prescriptions for this week win (percent/rpe waves); lp/dp fall back to
    // rendering identical sets from the working-weight state.
    const prescribed = db
      .select({
        reps: programSets.reps,
        intensityKind: programSets.intensityKind,
        intensityValue: programSets.intensityValue,
        amrap: programSets.amrap,
      })
      .from(programSets)
      .where(
        and(
          eq(programSets.programExerciseId, slot.programExerciseId),
          eq(programSets.weekIndex, weekIndex),
        ),
      )
      .orderBy(programSets.setNumber)
      .all();

    const sets: { reps: number; weightKg: number }[] =
      prescribed.length > 0
        ? prescribed.map((p) =>
            renderPrescribedSet(p, {
              currentWeightKg: slot.currentWeightKg,
              trainingMaxKg: slot.trainingMaxKg,
              e1rmKg: slot.e1rmKg,
              stepKg: program.roundingStepKg,
            }),
          )
        : suggestNext(
            {
              currentWeightKg: slot.currentWeightKg,
              currentReps: slot.currentReps,
              successStreak: slot.successStreak,
              failStreak: slot.failStreak,
            },
            slot.targetSets,
          );

    sets.forEach((set, index) => {
      addSet({
        sessionId,
        exerciseId: slot.exerciseId,
        setNumber: index + 1,
        reps: set.reps,
        weight: set.weightKg,
      });
    });
  }

  return sessionId;
}

/**
 * After a program session is finished, fold each exercise's completed sets into
 * its progression state, then advance the cursor one day (wrapping week/cycle).
 * Exercises with no completed set are left untouched (a skip is not a failure);
 * a deload week advances the cursor but applies no progression.
 */
function advanceProgram(
  programId: number,
  programDayId: number,
  weekIndex: number,
  sessionId: number,
): void {
  const week = db
    .select({ isDeload: programWeeks.isDeload })
    .from(programWeeks)
    .where(
      and(
        eq(programWeeks.programId, programId),
        eq(programWeeks.weekIndex, weekIndex),
      ),
    )
    .all()[0];
  const isDeload = week?.isDeload ?? false;

  const slots = db
    .select()
    .from(programExercises)
    .where(eq(programExercises.programDayId, programDayId))
    .all();

  if (!isDeload) {
    for (const slot of slots) {
      // Percentage schemes don't move per session — their training max bumps on
      // the cycle wrap (see `bumpTrainingMaxes`).
      if (slot.schemeType === 'percent') continue;

      const logged = db
        .select({
          reps: setLogs.reps,
          weight: setLogs.weight,
          rpe: setLogs.rpe,
        })
        .from(setLogs)
        .where(
          and(
            eq(setLogs.sessionId, sessionId),
            eq(setLogs.exerciseId, slot.exerciseId),
            isNotNull(setLogs.completedAt),
          ),
        )
        .orderBy(setLogs.setNumber)
        .all();
      if (logged.length === 0) continue; // untouched this session → leave as-is.

      const stateRow = db
        .select()
        .from(exerciseTrainingState)
        .where(eq(exerciseTrainingState.programExerciseId, slot.id))
        .all()[0];
      if (stateRow == null) continue;

      // RPE autoregulates: re-anchor the estimated 1RM from the best logged set
      // via the exact inverse of the render path, so a hit-the-prescription
      // session holds the anchor flat (and beating it raises it). Pre-filled sets
      // log no RPE, so fall back to the slot's target RPE (the load was rendered
      // at exactly that RPE).
      if (slot.schemeType === 'rpe') {
        const targetRpe = slot.targetRpe ?? 8;
        const best = Math.max(
          ...logged.map((s) =>
            e1rmFromLoggedSet(s.weight, s.reps, s.rpe ?? targetRpe),
          ),
        );
        db.update(exerciseTrainingState)
          .set({
            e1rmKg: best,
            lastReason: `Est. 1RM ${Math.round(best)} kg — autoregulated`,
          })
          .where(eq(exerciseTrainingState.id, stateRow.id))
          .run();
        continue;
      }

      const scheme: ProgressionScheme =
        slot.schemeType === 'dp'
          ? {
              type: 'dp',
              incrementKg: slot.incrementKg,
              minReps: slot.minReps ?? 1,
              maxReps: slot.maxReps ?? slot.minReps ?? 1,
            }
          : {
              type: 'lp',
              incrementKg: slot.incrementKg,
              failThreshold: slot.failThreshold,
              deloadPct: slot.deloadPct,
            };

      const { state, reason } = advance(
        scheme,
        {
          currentWeightKg: stateRow.currentWeightKg,
          currentReps: stateRow.currentReps,
          successStreak: stateRow.successStreak,
          failStreak: stateRow.failStreak,
        },
        logged.map((s) => ({ reps: s.reps, weightKg: s.weight })),
        slot.targetSets,
      );

      db.update(exerciseTrainingState)
        .set({
          currentWeightKg: state.currentWeightKg,
          currentReps: state.currentReps,
          successStreak: state.successStreak,
          failStreak: state.failStreak,
          lastReason: reason,
        })
        .where(eq(exerciseTrainingState.id, stateRow.id))
        .run();
    }
  }

  advanceProgramCursor(programId);
}

/** Move the program's cursor forward one day (wrapping week, then cycle). */
function advanceProgramCursor(programId: number): void {
  const program = db
    .select({
      currentWeek: programs.currentWeek,
      currentDayIndex: programs.currentDayIndex,
      currentCycle: programs.currentCycle,
    })
    .from(programs)
    .where(eq(programs.id, programId))
    .all()[0];
  if (program == null) return;

  const dayCount = db
    .select({ id: programDays.id })
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .all().length;
  const weekCount = db
    .select({ id: programWeeks.id })
    .from(programWeeks)
    .where(eq(programWeeks.programId, programId))
    .all().length;

  const next = advanceCursor(
    {
      currentWeek: program.currentWeek,
      currentDayIndex: program.currentDayIndex,
      currentCycle: program.currentCycle,
    },
    dayCount,
    weekCount,
  );

  db.update(programs)
    .set({
      currentWeek: next.currentWeek,
      currentDayIndex: next.currentDayIndex,
      currentCycle: next.currentCycle,
    })
    .where(eq(programs.id, programId))
    .run();

  // A completed cycle (a full pass through every week) bumps each percentage
  // exercise's training max — the 5/3/1 wave. This fires on the cycle wrap
  // itself, independent of whether the final week was a deload.
  if (next.currentCycle > program.currentCycle) {
    bumpTrainingMaxes(programId);
  }
}

/** Raise every percent-scheme slot's training max by its per-cycle increment. */
function bumpTrainingMaxes(programId: number): void {
  const slots = db
    .select({
      id: programExercises.id,
      tmIncrementKg: programExercises.tmIncrementKg,
      trainingMaxKg: exerciseTrainingState.trainingMaxKg,
    })
    .from(programExercises)
    .innerJoin(
      exerciseTrainingState,
      eq(exerciseTrainingState.programExerciseId, programExercises.id),
    )
    .where(
      and(
        eq(programExercises.programId, programId),
        eq(programExercises.schemeType, 'percent'),
      ),
    )
    .all();

  for (const slot of slots) {
    if (slot.trainingMaxKg == null) continue;
    db.update(exerciseTrainingState)
      .set({
        trainingMaxKg: slot.trainingMaxKg + slot.tmIncrementKg,
        lastReason: `+${slot.tmIncrementKg} kg training max — new cycle`,
      })
      .where(eq(exerciseTrainingState.programExerciseId, slot.id))
      .run();
  }
}
