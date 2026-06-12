import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/core/db/client';

import {
  advance,
  type ProgressionScheme,
  type ProgressionState,
  suggestNext,
} from './progression-engine';
import {
  exercises,
  exerciseTrainingState,
  programExercises,
  programs,
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
      dayIndex: workoutSessions.programDayIndex,
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

  if (session.programId != null) {
    advanceProgram(session.programId, session.dayIndex ?? 0, sessionId);
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

// ---------------------------------------------------------------------------
// Programs + progression (M5)
//
// Programs are the opt-in path: they drive the next session's suggested sets
// (`suggestNext`) and advance their own per-exercise state when a session is
// finished (`advance`). The decision logic lives in the unit-tested
// `progression-engine`; everything here is mechanical glue. State is keyed per
// (program, exercise) — phase-1 programs run one progression per lift.
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

export interface ProgramExerciseRow {
  id: number;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  dayIndex: number;
  position: number;
  schemeType: 'lp' | 'dp' | 'percent' | 'rpe';
  targetSets: number;
  incrementKg: number;
  minReps: number | null;
  maxReps: number | null;
  /** Current working weight (canonical kg) — convert at render. */
  currentWeightKg: number;
  currentReps: number;
  /** Why the suggestion is what it is (suggest+confirm); null before the first
   * finished session. */
  lastReason: string | null;
}

/** A program's exercises joined with their live progression state, for display. */
export function useProgramExercises(programId: number) {
  return useLiveQuery(
    db
      .select({
        id: programExercises.id,
        exerciseId: exercises.id,
        exerciseName: exercises.name,
        muscleGroup: exercises.muscleGroup,
        dayIndex: programExercises.dayIndex,
        position: programExercises.position,
        schemeType: programExercises.schemeType,
        targetSets: programExercises.targetSets,
        incrementKg: programExercises.incrementKg,
        minReps: programExercises.minReps,
        maxReps: programExercises.maxReps,
        currentWeightKg: exerciseTrainingState.currentWeightKg,
        currentReps: exerciseTrainingState.currentReps,
        lastReason: exerciseTrainingState.lastReason,
      })
      .from(programExercises)
      .innerJoin(exercises, eq(programExercises.exerciseId, exercises.id))
      .innerJoin(
        exerciseTrainingState,
        and(
          eq(exerciseTrainingState.programId, programExercises.programId),
          eq(exerciseTrainingState.exerciseId, programExercises.exerciseId),
        ),
      )
      .where(eq(programExercises.programId, programId))
      .orderBy(programExercises.dayIndex, programExercises.position),
    [programId],
  );
}

export function createProgram(name: string, description?: string): number {
  const result = db.insert(programs).values({ name, description }).run();
  return result.lastInsertRowId;
}

export function renameProgram(programId: number, name: string): void {
  db.update(programs).set({ name }).where(eq(programs.id, programId)).run();
}

export function deleteProgram(programId: number): void {
  db.delete(programs).where(eq(programs.id, programId)).run();
}

export interface AddProgramExerciseInput {
  programId: number;
  exerciseId: number;
  scheme: ProgressionScheme;
  targetSets: number;
  /** Starting working weight (canonical kg). */
  startingWeightKg: number;
  /** Starting rep target — required for lp (its rep target lives only in
   * state); dp ignores it and starts at `minReps`. */
  startingReps?: number;
  dayIndex?: number;
}

/**
 * Add an exercise to a program with its progression rule and seed its initial
 * training state (one row per program-exercise — guarded against duplicates).
 */
export function addProgramExercise(input: AddProgramExerciseInput): void {
  const { programId, exerciseId, scheme, targetSets } = input;
  const dayIndex = input.dayIndex ?? 0;

  const siblings = db
    .select({ id: programExercises.id })
    .from(programExercises)
    .where(
      and(
        eq(programExercises.programId, programId),
        eq(programExercises.dayIndex, dayIndex),
      ),
    )
    .all();

  db.insert(programExercises)
    .values({
      programId,
      exerciseId,
      dayIndex,
      position: siblings.length,
      schemeType: scheme.type,
      targetSets,
      incrementKg: scheme.incrementKg,
      minReps: scheme.type === 'dp' ? scheme.minReps : null,
      maxReps: scheme.type === 'dp' ? scheme.maxReps : null,
      failThreshold: scheme.type === 'lp' ? scheme.failThreshold : 3,
      deloadPct: scheme.type === 'lp' ? scheme.deloadPct : 0.1,
    })
    .run();

  // One state row per (program, exercise); never seed twice.
  const existing = db
    .select({ id: exerciseTrainingState.id })
    .from(exerciseTrainingState)
    .where(
      and(
        eq(exerciseTrainingState.programId, programId),
        eq(exerciseTrainingState.exerciseId, exerciseId),
      ),
    )
    .all();
  if (existing.length > 0) return;

  db.insert(exerciseTrainingState)
    .values({
      programId,
      exerciseId,
      currentWeightKg: input.startingWeightKg,
      currentReps:
        scheme.type === 'dp' ? scheme.minReps : (input.startingReps ?? 5),
      lastReason: 'Starting weight',
    })
    .run();
}

/**
 * Set an exercise's working weight (canonical kg) — used to seed the starting
 * weight before the first session sets progression in motion.
 */
export function setProgramExerciseWeight(
  programId: number,
  exerciseId: number,
  weightKg: number,
): void {
  db.update(exerciseTrainingState)
    .set({ currentWeightKg: weightKg })
    .where(
      and(
        eq(exerciseTrainingState.programId, programId),
        eq(exerciseTrainingState.exerciseId, exerciseId),
      ),
    )
    .run();
}

/** Remove an exercise slot from a program, along with its progression state. */
export function removeProgramExercise(
  programId: number,
  exerciseId: number,
): void {
  db.delete(programExercises)
    .where(
      and(
        eq(programExercises.programId, programId),
        eq(programExercises.exerciseId, exerciseId),
      ),
    )
    .run();
  db.delete(exerciseTrainingState)
    .where(
      and(
        eq(exerciseTrainingState.programId, programId),
        eq(exerciseTrainingState.exerciseId, exerciseId),
      ),
    )
    .run();
}

/**
 * Start a session from a program: pre-fill each exercise on the current day from
 * its progression suggestion (`suggestNext`) rather than last performance.
 * Returns the new session id.
 */
export function startProgramWorkout(programId: number): number {
  const program = db
    .select({ currentWeek: programs.currentWeek })
    .from(programs)
    .where(eq(programs.id, programId))
    .all()[0];
  if (program == null) throw new Error(`Program ${programId} not found`);

  const dayIndex = 0; // phase 1: single-day programs; waves land in phase 2.
  const result = db
    .insert(workoutSessions)
    .values({
      programId,
      programWeekIndex: program.currentWeek,
      programDayIndex: dayIndex,
    })
    .run();
  const sessionId = result.lastInsertRowId;

  const plan = db
    .select({
      exerciseId: programExercises.exerciseId,
      targetSets: programExercises.targetSets,
      currentWeightKg: exerciseTrainingState.currentWeightKg,
      currentReps: exerciseTrainingState.currentReps,
      successStreak: exerciseTrainingState.successStreak,
      failStreak: exerciseTrainingState.failStreak,
    })
    .from(programExercises)
    .innerJoin(
      exerciseTrainingState,
      and(
        eq(exerciseTrainingState.programId, programExercises.programId),
        eq(exerciseTrainingState.exerciseId, programExercises.exerciseId),
      ),
    )
    .where(
      and(
        eq(programExercises.programId, programId),
        eq(programExercises.dayIndex, dayIndex),
      ),
    )
    .orderBy(programExercises.position)
    .all();

  for (const slot of plan) {
    const state: ProgressionState = {
      currentWeightKg: slot.currentWeightKg,
      currentReps: slot.currentReps,
      successStreak: slot.successStreak,
      failStreak: slot.failStreak,
    };
    suggestNext(state, slot.targetSets).forEach((set, index) => {
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
 * its progression state. Exercises with no completed set this session are left
 * untouched (a skip is not a failed attempt → no phantom deload).
 */
function advanceProgram(
  programId: number,
  dayIndex: number,
  sessionId: number,
): void {
  const slots = db
    .select()
    .from(programExercises)
    .where(
      and(
        eq(programExercises.programId, programId),
        eq(programExercises.dayIndex, dayIndex),
      ),
    )
    .all();

  for (const slot of slots) {
    // Phase 1 advances lp/dp only; percentage/rpe schemes land later.
    if (slot.schemeType !== 'lp' && slot.schemeType !== 'dp') continue;

    const logged = db
      .select({ reps: setLogs.reps, weight: setLogs.weight })
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
      .where(
        and(
          eq(exerciseTrainingState.programId, programId),
          eq(exerciseTrainingState.exerciseId, slot.exerciseId),
        ),
      )
      .all()[0];
    if (stateRow == null) continue;

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
