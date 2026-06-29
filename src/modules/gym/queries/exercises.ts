import { desc, eq, isNotNull, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/core/db/client';

import { exercises, setLogs, workoutSessions } from '../schema';

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

export function setExerciseFavorite(
  exerciseId: number,
  isFavorite: boolean,
): void {
  db.update(exercises)
    .set({ isFavorite })
    .where(eq(exercises.id, exerciseId))
    .run();
}

/** Exercise ids used most recently (newest first) across finished sessions. */
export function useRecentExerciseIds(limit = 6): number[] {
  const { data } = useLiveQuery(
    db
      .select({ exerciseId: setLogs.exerciseId })
      .from(setLogs)
      .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
      .where(isNotNull(workoutSessions.finishedAt))
      .groupBy(setLogs.exerciseId)
      .orderBy(desc(sql`max(${workoutSessions.finishedAt})`))
      .limit(limit),
  );
  return data.map((row) => row.exerciseId);
}
