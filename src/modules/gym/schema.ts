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
 * routine, OR from a program.
 *
 * A program is a roadmap, not a flat list: it owns **days** (the split, e.g.
 * Push/Pull/Legs — `program_days`) and **weeks** (the periodization, e.g. an
 * undulating or deload wave — `program_weeks`). The cursor (`currentWeek` +
 * `currentDayIndex`, wrapping into `currentCycle`) tracks where the lifter is
 * and advances as sessions are logged. `roundingStepKg` is the loadable
 * increment that suggested weights snap to.
 */
export const programs = sqliteTable('programs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  lengthWeeks: integer('length_weeks').notNull().default(1),
  currentWeek: integer('current_week').notNull().default(1),
  // The next day (0-based, into `program_days.day_index`) to perform.
  currentDayIndex: integer('current_day_index').notNull().default(0),
  currentCycle: integer('current_cycle').notNull().default(1),
  // Loadable increment suggested weights round to (kg). 2.5 = standard plates.
  roundingStepKg: real('rounding_step_kg').notNull().default(2.5),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(now),
});

/** A day within a program (the split slot, e.g. "Push") — shared across weeks. */
export const programDays = sqliteTable('program_days', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programId: integer('program_id')
    .notNull()
    .references(() => programs.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull().default(0),
  name: text('name').notNull(),
});

/**
 * A week within a program — the periodization axis. `weekIndex` (1-based) is the
 * stable key that `program_sets` prescriptions reference; `isDeload` marks a
 * week where progression is skipped (Liftosaur's `progress: none`).
 */
export const programWeeks = sqliteTable('program_weeks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programId: integer('program_id')
    .notNull()
    .references(() => programs.id, { onDelete: 'cascade' }),
  weekIndex: integer('week_index').notNull().default(1),
  name: text('name'),
  isDeload: integer('is_deload', { mode: 'boolean' }).notNull().default(false),
});

/**
 * An exercise slot in a program day with its progression *rule* (config that
 * rarely changes). The mutable per-session state lives in
 * `exerciseTrainingState` (1:1, keyed by this slot's id); the per-week × per-set
 * prescription lives in `programSets`. `schemeType` discriminates the rule.
 */
export const programExercises = sqliteTable('program_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // `programId` is kept (denormalized) for cheap program-wide queries; the day
  // is the real parent.
  programId: integer('program_id')
    .notNull()
    .references(() => programs.id, { onDelete: 'cascade' }),
  programDayId: integer('program_day_id')
    .notNull()
    .references(() => programDays.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
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
  // Per-cycle training-max bump (percent scheme).
  tmIncrementKg: real('tm_increment_kg').notNull().default(2.5),
  // Target RPE for the autoregulated (rpe) scheme.
  targetRpe: real('target_rpe'),
});

/**
 * The per-week × per-set prescription for a program-exercise — the keystone that
 * expresses every scheme and arbitrary weekly waves in one table. `intensityKind`
 * says how to read `intensityValue`: `abs` = canonical kg, `pct` = fraction of
 * the training max (0.85 = 85%), `rpe` = target RPE. For lp/dp, per-week rows are
 * optional — when absent the engine derives `targetSets × currentReps` from the
 * scheme + state (weight comes from state), so simple schemes need no authoring.
 */
export const programSets = sqliteTable('program_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programExerciseId: integer('program_exercise_id')
    .notNull()
    .references(() => programExercises.id, { onDelete: 'cascade' }),
  weekIndex: integer('week_index').notNull().default(1),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps').notNull(),
  intensityKind: text('intensity_kind', {
    enum: ['abs', 'pct', 'rpe'],
  })
    .notNull()
    .default('abs'),
  intensityValue: real('intensity_value').notNull().default(0),
  amrap: integer('amrap', { mode: 'boolean' }).notNull().default(false),
  restSec: integer('rest_sec'),
});

/**
 * Mutable progression state, 1:1 with a program-exercise slot — the bit that
 * carries across sessions and cycles and lives in no set log. `trainingMaxKg`
 * drives percent schemes; `e1rmKg` anchors rpe; the rest drives lp/dp.
 */
export const exerciseTrainingState = sqliteTable('exercise_training_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programExerciseId: integer('program_exercise_id')
    .notNull()
    .references(() => programExercises.id, { onDelete: 'cascade' }),
  currentWeightKg: real('current_weight_kg').notNull().default(0),
  currentReps: integer('current_reps').notNull().default(5),
  successStreak: integer('success_streak').notNull().default(0),
  failStreak: integer('fail_streak').notNull().default(0),
  trainingMaxKg: real('training_max_kg'),
  // Estimated 1RM anchor (kg) for the rpe scheme; refreshed on advance.
  e1rmKg: real('e1rm_kg'),
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
  // Which program day this session was generated from (null = freestyle/routine).
  // No enforced FK: added via ALTER, where SQLite drops the ON DELETE clause.
  programDayId: integer('program_day_id'),
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

/**
 * Gym-module preferences. Single-row table (id pinned to 1), mirroring core
 * `app_settings` — module-specific prefs live in the module's own table, not in
 * core. Captured by the M2 backup/restore like every other table.
 */
export const gymSettings = sqliteTable('gym_settings', {
  id: integer('id').primaryKey().default(1),
  /** Default between-sets rest, in seconds. The ±30s timer controls write here. */
  defaultRestSec: integer('default_rest_sec').notNull().default(120),
});

export type Exercise = typeof exercises.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type SetLog = typeof setLogs.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type ProgramDay = typeof programDays.$inferSelect;
export type ProgramWeek = typeof programWeeks.$inferSelect;
export type ProgramExercise = typeof programExercises.$inferSelect;
export type ProgramSet = typeof programSets.$inferSelect;
export type ExerciseTrainingState = typeof exerciseTrainingState.$inferSelect;
export type GymSettings = typeof gymSettings.$inferSelect;
