import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// NOTE: relative imports only in schema files — drizzle-kit bundles them with
// esbuild, which does not resolve tsconfig path aliases.

const now = sql`(unixepoch() * 1000)`;

/** Exercise catalog (seeded defaults + user-created). */
export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group').notNull(),
  equipment: text('equipment'),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
});

/** A reusable workout template. */
export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
});

/** An exercise within a routine template, with its targets. */
export const routineExercises = sqliteTable('routine_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id')
    .notNull()
    .references(() => routines.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  targetSets: integer('target_sets').notNull().default(3),
  targetReps: integer('target_reps').notNull().default(10),
  targetWeight: real('target_weight'),
});

/** A logged workout instance (a session of actually doing the work). */
export const workoutSessions = sqliteTable('workout_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Null routine = freestyle workout. Keep the session if the routine is deleted.
  routineId: integer('routine_id').references(() => routines.id, {
    onDelete: 'set null',
  }),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull().default(now),
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  notes: text('notes'),
});

/** A single logged set within a session. */
export const setLogs = sqliteTable('set_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .notNull()
    .references(() => workoutSessions.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps').notNull(),
  weight: real('weight').notNull().default(0),
  rpe: real('rpe'),
  // Null = planned/incomplete set; a timestamp is written when it's checked off.
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
});

export type Exercise = typeof exercises.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type SetLog = typeof setLogs.$inferSelect;
