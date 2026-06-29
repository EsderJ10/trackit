import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Muscle } from './muscles';

// NOTE: relative imports only in schema files — drizzle-kit bundles them with
// esbuild, which does not resolve tsconfig path aliases. (`Muscle` is a
// type-only import, erased before bundling, so it adds no runtime dependency.)

const now = sql`(unixepoch() * 1000)`;

/** Exercise catalog (seeded defaults + user-created). */
export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group').notNull(),
  equipment: text('equipment'),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  /**
   * How a set of this exercise is measured. `weight_reps` (the default) is the
   * classic load×reps lift; `bodyweight` adds optional load to a rep count;
   * `duration` is timed work (planks, carries); `distance_time` pairs metres with
   * seconds (cardio). Gates the logging UI and excludes non-load kinds from 1RM
   * PRs and tonnage. See research.txt Part 1 #7.
   */
  measurementKind: text('measurement_kind', {
    enum: ['weight_reps', 'bodyweight', 'duration', 'distance_time'],
  })
    .notNull()
    .default('weight_reps'),
  /** One-line "what is this" summary shown atop the exercise detail screen. */
  description: text('description'),
  /**
   * Whether the movement crosses multiple joints (`compound`) or one
   * (`isolation`). Shown as a chip; helps a beginner understand what a lift is
   * for. Null for user-created exercises until they classify their own.
   */
  mechanic: text('mechanic', { enum: ['compound', 'isolation'] }),
  /**
   * The resistance direction: `push`, `pull`, or `static` (isometric). Drives a
   * chip today and enables future push/pull/legs auto-categorization. Null where
   * it doesn't cleanly apply (e.g. rotational core work) or for custom rows.
   */
  forceType: text('force_type', { enum: ['push', 'pull', 'static'] }),
  /**
   * Ordered form cues (setup → execution). Stored as a JSON string array; the
   * detail screen renders them as a checklist. Hand-authored for seeded rows,
   * null for user-created exercises until they add their own.
   */
  cues: text('cues', { mode: 'json' }).$type<string[]>(),
  /**
   * Common mistakes to avoid, as a JSON string array — rendered as a cautionary
   * checklist under the form cues. Hand-authored for seeded rows; the highest-
   * value teaching content for the mid-to-zero-knowledge audience. Null until set.
   */
  commonMistakes: text('common_mistakes', { mode: 'json' }).$type<string[]>(),
  /**
   * Fine muscles this movement trains, split by emphasis — JSON arrays of
   * `Muscle` ids (see `./muscles`). The anatomy diagram lights `primaryMuscles`
   * bright and `secondaryMuscles` dim. Independent of the coarse `muscleGroup`
   * bucket, but every id rolls up to one group via `MUSCLES`.
   */
  primaryMuscles: text('primary_muscles', { mode: 'json' }).$type<Muscle[]>(),
  secondaryMuscles: text('secondary_muscles', {
    mode: 'json',
  }).$type<Muscle[]>(),
  /**
   * User-pinned flag. Client state living on the catalog row (the table is
   * local-only); the reseed reconcile never touches it, so favourites survive
   * catalog updates.
   */
  isFavorite: integer('is_favorite', { mode: 'boolean' })
    .notNull()
    .default(false),
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
  /**
   * What kind of set this is. Only `working` counts toward 1RM PRs and program
   * progression; `warmup` is excluded from weekly volume while `drop`/`failure`
   * still count as hard volume. See research.txt Part 1 #3 and landmarks.ts.
   */
  setType: text('set_type', {
    enum: ['warmup', 'working', 'drop', 'failure'],
  })
    .notNull()
    .default('working'),
  // Non-`weight_reps` measurements land here (null otherwise): seconds of timed
  // work, and metres of distance work.
  durationSec: integer('duration_sec'),
  distanceM: real('distance_m'),
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
  /** Target finished workouts per week — drives the profile's weekly-goal ring. */
  weeklyWorkoutGoal: integer('weekly_workout_goal').notNull().default(3),
  /**
   * Which effort scale the logging/review UI surfaces: RPE (1–10) or RIR (reps
   * in reserve, 0–9). The two are the same stored value (`rir = 10 − rpe`), so
   * this is a pure display preference — sets always persist canonical RPE in
   * `set_logs.rpe`. See `./effort`.
   */
  effortScale: text('effort_scale', { enum: ['rpe', 'rir'] })
    .notNull()
    .default('rpe'),
  /**
   * The single program the user is currently following ("everything revolves
   * around it" — Train/Home surface its next workout). Null = no program picked,
   * fall back to ad-hoc training. Distinct from `programs.active` (which means
   * "in my library / not archived"). Set null on delete so the pointer can never
   * dangle.
   */
  currentProgramId: integer('current_program_id').references(
    () => programs.id,
    {
      onDelete: 'set null',
    },
  ),
});

/**
 * Per-muscle weekly volume landmarks (MV ≤ MEV ≤ MAV ≤ MRV, in sets/week) from
 * Renaissance Periodization. Keyed by the coarse `exercises.muscle_group` value
 * (e.g. 'Chest', 'Legs'). Seeded with editable defaults (`seedMuscleLandmarks`)
 * so a later settings panel can let users tune them to their own recovery —
 * captured by backup/restore like every other table.
 */
export const muscleLandmarks = sqliteTable('muscle_landmarks', {
  /** Matches `exercises.muscle_group` exactly. */
  muscleGroup: text('muscle_group').primaryKey(),
  /** Maintenance Volume — least that retains the muscle. */
  mv: integer('mv').notNull(),
  /** Minimum Effective Volume — least that still drives growth. */
  mev: integer('mev').notNull(),
  /** Maximum Adaptive Volume — top of the productive working range. */
  mav: integer('mav').notNull(),
  /** Maximum Recoverable Volume — recovery ceiling; beyond it is overreaching. */
  mrv: integer('mrv').notNull(),
});

export type Exercise = typeof exercises.$inferSelect;
export type MuscleLandmark = typeof muscleLandmarks.$inferSelect;
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
