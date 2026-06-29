import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/core/db/client';

import { exercises, routineExercises, routines } from '../schema';

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
  supersetGroup: number | null;
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
        supersetGroup: routineExercises.supersetGroup,
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

/** Rewrite each routine_exercises row's `position` to its index in `orderedIds`, in one transaction. */
export function reorderRoutineExercises(orderedIds: number[]): void {
  db.transaction((tx) => {
    orderedIds.forEach((id, index) => {
      tx.update(routineExercises)
        .set({ position: index })
        .where(eq(routineExercises.id, id))
        .run();
    });
  });
}

/** Apply superset_group changes (null clears) for a routine's exercises in one transaction. */
export function updateRoutineSupersets(
  updates: { id: number; supersetGroup: number | null }[],
): void {
  db.transaction((tx) => {
    for (const update of updates) {
      tx.update(routineExercises)
        .set({ supersetGroup: update.supersetGroup })
        .where(eq(routineExercises.id, update.id))
        .run();
    }
  });
}
