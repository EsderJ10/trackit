import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

import type { Muscle } from './muscles';

// NOTE: relative imports only in schema files — drizzle-kit bundles them with
// esbuild, which ignores tsconfig path aliases.

const now = sql`(unixepoch() * 1000)`;

/** Exercise catalog (seeded defaults + user-created). */
export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group').notNull(),
  equipment: text('equipment'),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  /**
   * How a set is measured: `weight_reps` (load×reps), `bodyweight` (+optional
   * load), `duration` (timed), `distance_time` (cardio). Gates the logging UI and
   * excludes non-load kinds from 1RM PRs and tonnage. See research.txt Part 1 #7.
   */
  measurementKind: text('measurement_kind', {
    enum: ['weight_reps', 'bodyweight', 'duration', 'distance_time'],
  })
    .notNull()
    .default('weight_reps'),
  /** One-line summary shown atop the exercise detail screen. */
  description: text('description'),
  /** Multi-joint (`compound`) vs single-joint (`isolation`). Null for custom rows. */
  mechanic: text('mechanic', { enum: ['compound', 'isolation'] }),
  /** Resistance direction; null where push/pull/static doesn't fit (e.g. rotation) or for custom rows. */
  forceType: text('force_type', { enum: ['push', 'pull', 'static'] }),
  /** Ordered form cues (setup → execution), JSON string array. Null for custom rows. */
  cues: text('cues', { mode: 'json' }).$type<string[]>(),
  /** Common mistakes, JSON string array. Null for custom rows. */
  commonMistakes: text('common_mistakes', { mode: 'json' }).$type<string[]>(),
  /**
   * Fine muscles trained, split by emphasis — JSON arrays of `Muscle` ids (see
   * `./muscles`); diagram lights primary bright, secondary dim. Every id rolls up
   * to one `muscleGroup` via `MUSCLES`.
   */
  primaryMuscles: text('primary_muscles', { mode: 'json' }).$type<Muscle[]>(),
  secondaryMuscles: text('secondary_muscles', {
    mode: 'json',
  }).$type<Muscle[]>(),
  /** User-pinned flag; the reseed reconcile never touches it, so favourites survive catalog updates. */
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
export const routineExercises = sqliteTable(
  'routine_exercises',
  {
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
    // Superset grouping: rows sharing a non-null value run back-to-back (A/B/…);
    // null = standalone. Value is an opaque per-routine group id, not a global key.
    supersetGroup: integer('superset_group'),
  },
  (t) => [index('routine_exercises_routine_id_idx').on(t.routineId)],
);

/**
 * An opt-in periodized plan driving progression suggestions — parallel to
 * routines (a session is freestyle, from a routine, OR from a program). Owns
 * **days** (the split, `program_days`) and **weeks** (periodization,
 * `program_weeks`); the cursor (`currentWeek` + `currentDayIndex`, wrapping into
 * `currentCycle`) advances as sessions are logged.
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
export const programDays = sqliteTable(
  'program_days',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    dayIndex: integer('day_index').notNull().default(0),
    name: text('name').notNull(),
  },
  (t) => [index('program_days_program_id_idx').on(t.programId)],
);

/**
 * A week within a program. `weekIndex` (1-based) is the stable key that
 * `program_sets` reference; `isDeload` skips progression (Liftosaur `progress: none`).
 */
export const programWeeks = sqliteTable(
  'program_weeks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    weekIndex: integer('week_index').notNull().default(1),
    name: text('name'),
    isDeload: integer('is_deload', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (t) => [index('program_weeks_program_id_idx').on(t.programId)],
);

/**
 * An exercise slot in a program day with its progression *rule* (`schemeType`
 * discriminates). Mutable per-session state lives in `exerciseTrainingState`
 * (1:1, keyed by this slot's id); the per-week × per-set prescription in `programSets`.
 */
export const programExercises = sqliteTable(
  'program_exercises',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Denormalized for cheap program-wide queries; the day is the real parent.
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
    // Superset grouping within a program day: shared non-null value runs
    // back-to-back (A/B/…); null = standalone. Value is the anchor row's id,
    // unique across the table so day groups never collide.
    supersetGroup: integer('superset_group'),
  },
  (t) => [
    index('program_exercises_program_day_id_idx').on(t.programDayId),
    index('program_exercises_program_id_idx').on(t.programId),
  ],
);

/**
 * The per-week × per-set prescription for a program-exercise. `intensityKind`
 * reads `intensityValue`: `abs` = canonical kg, `pct` = fraction of TM (0.85 =
 * 85%), `rpe` = target RPE. For lp/dp, per-week rows are optional — absent, the
 * engine derives sets from scheme + state, so simple schemes need no authoring.
 */
export const programSets = sqliteTable(
  'program_sets',
  {
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
  },
  (t) => [
    index('program_sets_program_exercise_id_idx').on(t.programExerciseId),
  ],
);

/**
 * Mutable progression state, 1:1 with a program-exercise slot. `trainingMaxKg`
 * drives percent schemes; `e1rmKg` anchors rpe; the rest drives lp/dp.
 */
export const exerciseTrainingState = sqliteTable(
  'exercise_training_state',
  {
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
  },
  (t) => [
    index('exercise_training_state_program_exercise_id_idx').on(
      t.programExerciseId,
    ),
  ],
);

/** A logged workout instance (a session of actually doing the work). */
export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Null = freestyle. set null on delete: keep the session if the routine goes.
    routineId: integer('routine_id').references(() => routines.id, {
      onDelete: 'set null',
    }),
    // Program provenance (all null = freestyle/routine). set null: keep on delete.
    programId: integer('program_id').references(() => programs.id, {
      onDelete: 'set null',
    }),
    programWeekIndex: integer('program_week_index'),
    programDayIndex: integer('program_day_index'),
    // No enforced FK: added via ALTER, where SQLite drops the ON DELETE clause.
    programDayId: integer('program_day_id'),
    startedAt: integer('started_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(now),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
    notes: text('notes'),
  },
  (t) => [
    // Finished lists order by finishedAt; active-session lookup filters it NULL and orders by startedAt.
    index('workout_sessions_finished_at_idx').on(t.finishedAt),
    index('workout_sessions_started_at_idx').on(t.startedAt),
  ],
);

/** A single logged set within a session. */
export const setLogs = sqliteTable(
  'set_logs',
  {
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
     * Only `working` counts toward 1RM PRs and progression; `warmup` is excluded
     * from weekly volume, `drop`/`failure` still count as hard volume. See
     * research.txt Part 1 #3 and landmarks.ts.
     */
    setType: text('set_type', {
      enum: ['warmup', 'working', 'drop', 'failure'],
    })
      .notNull()
      .default('working'),
    // Non-`weight_reps` measurements (null otherwise): timed seconds, distance metres.
    durationSec: integer('duration_sec'),
    distanceM: real('distance_m'),
    // Null = planned/incomplete; timestamped when checked off.
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    // Hot path: per-session reads + last-performance/PR lookups (exercise + set type, by completion time).
    index('set_logs_session_id_idx').on(t.sessionId),
    index('set_logs_exercise_set_type_completed_idx').on(
      t.exerciseId,
      t.setType,
      t.completedAt,
    ),
  ],
);

/** Gym-module preferences. Single-row table (id pinned to 1); module prefs live here, not in core. */
export const gymSettings = sqliteTable('gym_settings', {
  id: integer('id').primaryKey().default(1),
  /** Default between-sets rest, in seconds (0 = disabled). The ±15s timer controls write here. */
  defaultRestSec: integer('default_rest_sec').notNull().default(120),
  /** Target finished workouts per week — drives the profile's weekly-goal ring. */
  weeklyWorkoutGoal: integer('weekly_workout_goal').notNull().default(3),
  /**
   * Display preference only: RPE (1–10) or RIR (0–9), same stored value
   * (`rir = 10 − rpe`). Sets always persist canonical RPE in `set_logs.rpe`. See `./effort`.
   */
  effortScale: text('effort_scale', { enum: ['rpe', 'rir'] })
    .notNull()
    .default('rpe'),
  /**
   * The single program currently being followed (Train/Home surface its next
   * workout); null = ad-hoc. Distinct from `programs.active` ("in my library").
   * set null on delete so the pointer can't dangle.
   */
  currentProgramId: integer('current_program_id').references(
    () => programs.id,
    {
      onDelete: 'set null',
    },
  ),
});

/**
 * Per-muscle weekly volume landmarks (MV ≤ MEV ≤ MAV ≤ MRV, sets/week) from
 * Renaissance Periodization, keyed by `exercises.muscle_group`. Seeded with
 * editable defaults (`seedMuscleLandmarks`).
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

// Column-derived enum unions — single source of truth, so callers never
// re-declare these literals by hand.
export type SetType = SetLog['setType'];
export type MeasurementKind = Exercise['measurementKind'];
