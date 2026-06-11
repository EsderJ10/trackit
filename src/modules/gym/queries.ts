import { desc, eq, isNotNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/core/db/client';

import {
  exercises,
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
  const result = db
    .insert(routines)
    .values({ name, description })
    .run();
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
  patch: Partial<{ targetSets: number; targetReps: number; targetWeight: number | null }>,
): void {
  db.update(routineExercises).set(patch).where(eq(routineExercises.id, id)).run();
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
  return result.lastInsertRowId;
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
  completedAt: Date;
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
      .orderBy(setLogs.completedAt),
    [sessionId],
  );
}

export interface LogSetInput {
  sessionId: number;
  exerciseId: number;
  setNumber: number;
  reps: number;
  weight: number;
  rpe?: number;
}

export function logSet(input: LogSetInput): void {
  db.insert(setLogs)
    .values({
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      reps: input.reps,
      weight: input.weight,
      rpe: input.rpe ?? null,
    })
    .run();
}

export function deleteSetLog(id: number): void {
  db.delete(setLogs).where(eq(setLogs.id, id)).run();
}

export function finishWorkout(sessionId: number): void {
  db.update(workoutSessions)
    .set({ finishedAt: new Date() })
    .where(eq(workoutSessions.id, sessionId))
    .run();
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
}

export function useFinishedSessions() {
  return useLiveQuery(
    db
      .select({
        id: workoutSessions.id,
        routineName: routines.name,
        startedAt: workoutSessions.startedAt,
        finishedAt: workoutSessions.finishedAt,
      })
      .from(workoutSessions)
      .leftJoin(routines, eq(workoutSessions.routineId, routines.id))
      .where(isNotNull(workoutSessions.finishedAt))
      .orderBy(desc(workoutSessions.finishedAt)),
  );
}

export interface GymStats {
  weeklyVolume: number;
  weeklySets: number;
  lastWorkout: { name: string; finishedAt: Date } | null;
}

export function useGymStats(): GymStats {
  const { data: sets } = useLiveQuery(
    db
      .select({ weight: setLogs.weight, reps: setLogs.reps, completedAt: setLogs.completedAt })
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
    const cutoff = Date.now() - WEEK_MS;
    const weekly = sets.filter((s) => s.completedAt.getTime() >= cutoff);
    const weeklyVolume = weekly.reduce((sum, s) => sum + s.weight * s.reps, 0);
    const last = lastSessions[0];
    return {
      weeklyVolume: Math.round(weeklyVolume),
      weeklySets: weekly.length,
      lastWorkout:
        last && last.finishedAt
          ? { name: last.routineName ?? 'Freestyle', finishedAt: last.finishedAt }
          : null,
    };
  }, [sets, lastSessions]);
}
