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
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(now),
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

/**
 * A program: an opt-in, periodized plan that drives progression suggestions.
 * Parallel to (not a replacement for) routines — a session is freestyle, from a
 * routine, OR from a program. The cursor (`currentWeek`/`currentCycle`) advances
 * as the user logs sessions; weeks/cycles only bite once the percentage/wave
 * schemes land (M5 phase 2), but the container holds them from the start.
 */
export const programs = sqliteTable('programs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  lengthWeeks: integer('length_weeks').notNull().default(1),
  currentWeek: integer('current_week').notNull().default(1),
  currentCycle: integer('current_cycle').notNull().default(1),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(now),
});

/**
 * An exercise slot in a program with its progression *rule* (config that rarely
 * changes). The mutable per-session state lives in `exerciseTrainingState`.
 * `schemeType` discriminates the rule; phase 1 ships `lp` and `dp`.
 */
export const programExercises = sqliteTable('program_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programId: integer('program_id')
    .notNull()
    .references(() => programs.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull().default(0),
  position: integer('position').notNull().default(0),
  schemeType: text('scheme_type', {
    enum: ['lp', 'dp', 'percent', 'rpe'],
  }).notNull(),
  targetSets: integer('target_sets').notNull().default(3),
  // Weight added on success (lp) / on clearing the rep ceiling (dp).
  incrementKg: real('increment_kg').notNull().default(2.5),
  // Double-progression rep range (null for non-dp schemes).
  minReps: integer('min_reps'),
  maxReps: integer('max_reps'),
  // Linear-progression deload trigger + size.
  failThreshold: integer('fail_threshold').notNull().default(3),
  deloadPct: real('deload_pct').notNull().default(0.1),
});

/**
 * Mutable progression state, keyed per (program, exercise) — the bit that
 * carries across sessions and cycles and lives in no set log. `trainingMaxKg`
 * is unused until the percentage schemes (phase 2); the rest drives lp/dp.
 */
export const exerciseTrainingState = sqliteTable('exercise_training_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programId: integer('program_id')
    .notNull()
    .references(() => programs.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  currentWeightKg: real('current_weight_kg').notNull().default(0),
  currentReps: integer('current_reps').notNull().default(5),
  successStreak: integer('success_streak').notNull().default(0),
  failStreak: integer('fail_streak').notNull().default(0),
  trainingMaxKg: real('training_max_kg'),
  // The human-readable explanation of the current suggestion (suggest+confirm).
  lastReason: text('last_reason'),
});

/** A logged workout instance (a session of actually doing the work). */
export const workoutSessions = sqliteTable('workout_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Null routine = freestyle workout. Keep the session if the routine is deleted.
  routineId: integer('routine_id').references(() => routines.id, {
    onDelete: 'set null',
  }),
  // Program provenance (all null = freestyle/routine, i.e. pre-M5 behavior).
  // Keep the session if the program is deleted.
  programId: integer('program_id').references(() => programs.id, {
    onDelete: 'set null',
  }),
  programWeekIndex: integer('program_week_index'),
  programDayIndex: integer('program_day_index'),
  startedAt: integer('started_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(now),
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
export type Program = typeof programs.$inferSelect;
export type ProgramExercise = typeof programExercises.$inferSelect;
export type ExerciseTrainingState = typeof exerciseTrainingState.$inferSelect;
