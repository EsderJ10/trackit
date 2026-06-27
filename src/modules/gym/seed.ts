import { and, eq } from 'drizzle-orm';

import type { AppDatabase } from '@/core/db/client';

import { DEFAULT_MUSCLE_LANDMARKS } from './landmarks';
import type { Muscle } from './muscles';
import { exercises, muscleLandmarks } from './schema';

type MeasurementKind =
  | 'weight_reps'
  | 'bodyweight'
  | 'duration'
  | 'distance_time';

interface SeedExercise {
  name: string;
  muscleGroup: string;
  equipment: string;
  /** Defaults to 'weight_reps' when omitted. */
  measurementKind?: MeasurementKind;
  /** One-line summary shown atop the detail screen. */
  description: string;
  /** Ordered form cues (setup → execution). */
  cues: string[];
  /** Fine muscles worked, lit bright on the anatomy diagram. */
  primaryMuscles: Muscle[];
  /** Supporting muscles, lit dim on the anatomy diagram (may be empty). */
  secondaryMuscles: Muscle[];
}

/**
 * Canonical default catalog — the target end-state, not a one-shot insert list.
 *
 * Names follow `Base Movement (Discriminator)` so the many ways to do one
 * movement (Bench Press: Barbell / Dumbbell / Smith / Incline…) each get their
 * own row. That matters because set history/PRs key on `exercises.id`
 * (`set_logs.exercise_id`), so distinct rows = distinct progress per variant.
 * The parenthetical form also clusters variants in the picker, which sorts by
 * `muscle_group, name`. Single-form staples stay bare (Push-up, Plank, …).
 *
 * `equipment` stays within the existing 5 values; the parenthetical name
 * carries finer detail (Smith bench → name `(Smith)`, equipment `Machine`;
 * EZ-bar curl → name `(EZ-Bar)`, equipment `Barbell`).
 */
const CATALOG: readonly SeedExercise[] = [
  // Legs
  {
    name: 'Back Squat (Barbell)',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    description:
      'A barbell racked on the upper back and squatted to depth — the foundational lower-body strength builder.',
    cues: [
      'Bar on the rear delts, brace your core hard',
      'Break at the hips and knees together',
      'Sink to at least parallel, knees tracking over the toes',
      'Drive through the midfoot to stand tall',
    ],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'adductors', 'lower_back', 'abs'],
  },
  {
    name: 'Romanian Deadlift',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    description:
      'A hip-hinge with near-straight legs that loads the hamstrings and glutes through a deep stretch.',
    cues: [
      'Soft knees, push the hips back',
      'Keep the bar dragging close to your legs',
      'Lower until you feel a hamstring stretch',
      'Squeeze the glutes to drive the hips forward',
    ],
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back', 'traps', 'forearms'],
  },
  {
    name: 'Leg Press (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    description:
      'A machine press that overloads the quads and glutes with the spine fully supported.',
    cues: [
      'Feet shoulder-width on the platform',
      'Lower until the knees reach about 90°',
      "Don't let the lower back round off the pad",
      'Press up without snapping the knees locked',
    ],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'adductors'],
  },
  {
    name: 'Leg Extension (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    description:
      'A seated isolation that targets the quads through full knee extension.',
    cues: [
      'Align the knee with the machine pivot',
      'Extend to a straight leg and pause briefly',
      'Lower under control',
      'Avoid swinging the weight up',
    ],
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
  },
  {
    name: 'Leg Curl (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    description:
      'A lying isolation that flexes the knee to target the hamstrings.',
    cues: [
      'Pad set just above the heels',
      'Curl fully toward your glutes',
      'Keep the hips pressed into the bench',
      "Lower slowly, don't let it slam",
    ],
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves'],
  },
  {
    name: 'Seated Leg Curl (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    description:
      'A seated knee-flexion curl that trains the hamstrings in a lengthened position.',
    cues: [
      'Thigh pad locked snug over the legs',
      'Curl down and back as far as possible',
      'Pause at peak contraction',
      'Control the stretch on the way up',
    ],
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves'],
  },
  {
    name: 'Hip Abduction (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    description:
      'A seated machine that pushes the knees apart to target the glute medius and outer hips.',
    cues: [
      'Sit tall against the back pad',
      'Press the knees outward to full range',
      'Pause at the widest point',
      'Return slowly without bouncing',
    ],
    primaryMuscles: ['glutes'],
    secondaryMuscles: [],
  },
  {
    name: 'Bulgarian Split Squat',
    muscleGroup: 'Legs',
    equipment: 'Dumbbell',
    description:
      'A rear-foot-elevated single-leg squat that hammers the quads and glutes one side at a time.',
    cues: [
      'Back foot on the bench, weight on the front leg',
      'Drop straight down, front shin near vertical',
      'Keep your torso tall',
      'Drive through the front heel to rise',
    ],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'adductors'],
  },
  {
    name: 'Seated Calf Raise (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    description:
      'A bent-knee seated raise that isolates the soleus of the calf.',
    cues: [
      'Pad on the lower thighs, balls of the feet on the platform',
      'Drop the heels for a full stretch',
      'Press up onto the toes',
      'Pause and squeeze at the top',
    ],
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
  },
  // Chest
  {
    name: 'Bench Press (Barbell)',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    description:
      'The benchmark horizontal press — a barbell driven off the chest to build pressing strength.',
    cues: [
      'Shoulder blades pinched, slight arch',
      'Lower the bar to mid-chest',
      'Elbows tucked to about 75°, not flared wide',
      'Press up and slightly back over the shoulders',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts'],
  },
  {
    name: 'Bench Press (Dumbbell)',
    muscleGroup: 'Chest',
    equipment: 'Dumbbell',
    description:
      'A dumbbell bench press allowing a deeper stretch and independent arm work.',
    cues: [
      'Start with the dumbbells over the chest',
      'Lower to chest level with a stretch',
      'Keep the wrists stacked over the elbows',
      'Press up without clashing the bells',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts'],
  },
  {
    name: 'Bench Press (Smith)',
    muscleGroup: 'Chest',
    equipment: 'Machine',
    description:
      'A fixed-bar bench press on the Smith machine for a stable pressing groove.',
    cues: [
      'Set the bar to touch mid-chest',
      'Unrack and brace',
      'Lower under control to the chest',
      'Press straight up the fixed track',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts'],
  },
  {
    name: 'Incline Bench Press (Barbell)',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    description:
      'A barbell press on an inclined bench that biases the upper chest.',
    cues: [
      'Bench set to about 30°',
      'Lower the bar to the upper chest near the collarbone',
      'Keep the elbows under the bar',
      'Press up over the shoulders',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
  },
  {
    name: 'Incline Bench Press (Dumbbell)',
    muscleGroup: 'Chest',
    equipment: 'Dumbbell',
    description:
      'An incline dumbbell press emphasising the upper chest with a long stretch.',
    cues: [
      'Bench at about 30°, dumbbells over the upper chest',
      'Lower to a deep stretch at chest level',
      'Wrists stacked over the elbows',
      'Press up and slightly together',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
  },
  {
    name: 'Seated Chest Press (Machine)',
    muscleGroup: 'Chest',
    equipment: 'Machine',
    description:
      'A seated machine press that trains the chest on a fixed, beginner-friendly path.',
    cues: [
      'Set the seat so the handles sit at mid-chest',
      'Press out without locking hard',
      'Squeeze the chest at full reach',
      'Return until you feel a stretch',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts'],
  },
  {
    name: 'Pec Deck Fly',
    muscleGroup: 'Chest',
    equipment: 'Machine',
    description:
      'A seated fly machine that isolates the chest through horizontal adduction.',
    cues: [
      'Forearms on the pads, slight elbow bend',
      'Bring the pads together in front',
      'Squeeze the chest in the middle',
      'Open slowly to a stretch',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts'],
  },
  {
    name: 'Push-up',
    muscleGroup: 'Chest',
    equipment: 'Bodyweight',
    measurementKind: 'bodyweight',
    description:
      'A scalable bodyweight horizontal press for the chest, triceps and core.',
    cues: [
      'Hands just wider than the shoulders',
      'Body in a straight line, brace the core',
      'Lower until the chest nearly touches',
      "Press up, don't let the hips sag",
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts', 'abs'],
  },
  // Back
  {
    name: 'Deadlift',
    muscleGroup: 'Back',
    equipment: 'Barbell',
    description:
      'The full-body pull — lifting a loaded barbell from the floor to a standing lockout.',
    cues: [
      'Bar over the midfoot, shins close',
      'Flat back, chest up, brace hard',
      'Push the floor away and drag the bar up',
      'Lock out the hips and knees together',
    ],
    primaryMuscles: ['glutes', 'hamstrings', 'lower_back'],
    secondaryMuscles: ['traps', 'lats', 'forearms', 'quads'],
  },
  {
    name: 'Pull-up',
    muscleGroup: 'Back',
    equipment: 'Bodyweight',
    measurementKind: 'bodyweight',
    description:
      'A bodyweight vertical pull — hanging from a bar and pulling the chin over it.',
    cues: [
      'Overhand grip just wider than the shoulders',
      'Start from a full dead hang',
      'Drive the elbows down and back',
      'Pull the chin over the bar, lower with control',
    ],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'traps', 'rear_delts', 'forearms'],
  },
  {
    name: 'Bent-Over Row (Barbell)',
    muscleGroup: 'Back',
    equipment: 'Barbell',
    description: 'A hinged barbell row that builds mid-back thickness.',
    cues: [
      'Hinge to about 45°, flat back',
      'Let the bar hang at arm’s length',
      'Row to the lower ribs or belly',
      'Squeeze the shoulder blades, lower slow',
    ],
    primaryMuscles: ['lats', 'traps'],
    secondaryMuscles: ['rear_delts', 'biceps', 'lower_back'],
  },
  {
    name: 'Lat Pulldown (Cable)',
    muscleGroup: 'Back',
    equipment: 'Cable',
    description:
      'A cable vertical pull that trains the lats with adjustable load — a pull-up regression.',
    cues: [
      'Grip wider than the shoulders, chest up',
      'Pull the bar to your upper chest',
      'Drive the elbows down toward your hips',
      'Control the bar back to a full stretch',
    ],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'rear_delts', 'traps'],
  },
  {
    name: 'Seated Lat Pulldown (Machine)',
    muscleGroup: 'Back',
    equipment: 'Machine',
    description:
      'A machine pulldown with the torso braced against pads for stable vertical pulling.',
    cues: [
      'Lock the thigh pads snug',
      'Pull the handles to your collarbone',
      'Lead with the elbows',
      'Return to a full overhead stretch',
    ],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'rear_delts'],
  },
  {
    name: 'Chest-Supported Row (Machine)',
    muscleGroup: 'Back',
    equipment: 'Machine',
    description:
      'A row with the chest braced on a pad, removing lower-back strain to isolate the back.',
    cues: [
      'Chest flat on the pad',
      'Row the handles toward your hips',
      'Squeeze the shoulder blades together',
      'Extend the arms fully each rep',
    ],
    primaryMuscles: ['lats', 'traps'],
    secondaryMuscles: ['rear_delts', 'biceps'],
  },
  {
    name: 'T-Bar Row',
    muscleGroup: 'Back',
    equipment: 'Machine',
    description: 'A landmine T-bar row that loads heavy for mid-back mass.',
    cues: [
      'Hinge over the bar, flat back',
      'Pull the handles to your torso',
      'Drive the elbows past your ribs',
      'Lower under control to a stretch',
    ],
    primaryMuscles: ['lats', 'traps'],
    secondaryMuscles: ['rear_delts', 'biceps', 'lower_back'],
  },
  {
    name: 'Single-Arm Dumbbell Row',
    muscleGroup: 'Back',
    equipment: 'Dumbbell',
    description:
      'A one-arm braced row for unilateral back development and a long range of motion.',
    cues: [
      'One hand and knee on the bench',
      'Let the dumbbell hang fully',
      'Row to your hip, elbow close to the body',
      'Squeeze, then lower to a full stretch',
    ],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['traps', 'rear_delts', 'biceps'],
  },
  // Shoulders
  {
    name: 'Overhead Press (Barbell)',
    muscleGroup: 'Shoulders',
    equipment: 'Barbell',
    description:
      'A standing barbell press overhead — the core builder for shoulder strength.',
    cues: [
      'Bar on the front delts, grip just outside the shoulders',
      'Brace the glutes and core',
      'Press up, move the head back then through',
      'Lock out with the bar over the mid-skull',
    ],
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['triceps', 'traps'],
  },
  {
    name: 'Overhead Press (Dumbbell)',
    muscleGroup: 'Shoulders',
    equipment: 'Dumbbell',
    description:
      'A seated or standing dumbbell shoulder press with a free range of motion.',
    cues: [
      'Dumbbells at shoulder height',
      'Press up without fully flaring the elbows',
      'Stop just short of clashing overhead',
      'Lower under control to ear level',
    ],
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['triceps', 'traps'],
  },
  {
    name: 'Lateral Raise (Dumbbell)',
    muscleGroup: 'Shoulders',
    equipment: 'Dumbbell',
    description:
      'An isolation raising the arms out to the sides for wider, capped (lateral) delts.',
    cues: [
      'Slight bend in the elbows',
      'Lead with the elbows, not the hands',
      'Raise to shoulder height, no higher',
      'Lower slowly — resist the drop',
    ],
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['traps'],
  },
  {
    name: 'Cable Rear Delt Fly',
    muscleGroup: 'Shoulders',
    equipment: 'Cable',
    description:
      'A cross-body cable fly that isolates the rear delts and upper back.',
    cues: [
      'Cables set at shoulder height, arms crossed',
      'Pull out and back in a wide arc',
      'Keep a fixed slight elbow bend',
      'Squeeze the rear delts, return slow',
    ],
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: ['traps'],
  },
  // Arms
  {
    name: 'Bicep Curl (Dumbbell)',
    muscleGroup: 'Arms',
    equipment: 'Dumbbell',
    description: 'The classic dumbbell curl for the biceps, one arm or both.',
    cues: [
      'Elbows pinned to your sides',
      'Curl without swinging the torso',
      'Squeeze at the top',
      'Lower fully to a straight arm',
    ],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  {
    name: 'Bicep Curl (EZ-Bar)',
    muscleGroup: 'Arms',
    equipment: 'Barbell',
    description:
      'An angled-bar curl that is easier on the wrists while loading the biceps.',
    cues: [
      'Grip the inner angles, elbows tucked',
      'Curl the bar up under control',
      'Keep the elbows still',
      'Lower all the way down',
    ],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  {
    name: 'Tricep Pushdown (Cable)',
    muscleGroup: 'Arms',
    equipment: 'Cable',
    description:
      'A cable pushdown that isolates the triceps with constant tension.',
    cues: [
      'Elbows pinned to your sides',
      'Push down to a full lockout',
      'Squeeze the triceps at the bottom',
      'Let the cable return without flaring the elbows',
    ],
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
  },
  {
    name: 'Overhead Triceps Extension (Dumbbell)',
    muscleGroup: 'Arms',
    equipment: 'Dumbbell',
    description:
      'An overhead extension that loads the triceps long head through a deep stretch.',
    cues: [
      'Hold one dumbbell overhead with both hands',
      'Lower behind your head, elbows in',
      'Feel the stretch at the bottom',
      'Extend to lockout without flaring',
    ],
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
  },
  // Core
  {
    name: 'Plank',
    muscleGroup: 'Core',
    equipment: 'Bodyweight',
    measurementKind: 'duration',
    description:
      'An isometric hold that braces the entire core against gravity.',
    cues: [
      'Forearms under the shoulders',
      'Straight line from head to heels',
      'Squeeze the glutes and brace the abs',
      "Don't let the hips sag or pike",
    ],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
  },
  {
    name: 'Hanging Leg Raise',
    muscleGroup: 'Core',
    equipment: 'Bodyweight',
    measurementKind: 'bodyweight',
    description:
      'A hanging movement that raises the legs to train the lower abs and hip flexors.',
    cues: [
      'Dead hang, shoulders active',
      'Raise the legs to at least hip height',
      'Avoid swinging — control the motion',
      'Lower slowly to a full hang',
    ],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques', 'forearms'],
  },
  {
    name: 'Crunch',
    muscleGroup: 'Core',
    equipment: 'Bodyweight',
    measurementKind: 'bodyweight',
    description: 'A short-range trunk flexion that isolates the abs.',
    cues: [
      'Lie back, knees bent',
      'Curl the shoulders off the floor',
      'Exhale and squeeze the abs',
      "Lower under control, don't yank the neck",
    ],
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
  },
  // Cardio — measured by distance+time or duration, not load×reps.
  {
    name: 'Treadmill Run',
    muscleGroup: 'Cardio',
    equipment: 'Machine',
    measurementKind: 'distance_time',
    description:
      'Steady or interval running on a treadmill — logged by distance and time.',
    cues: [
      'Warm up at an easy pace',
      'Land midfoot under your hips',
      'Keep an upright, relaxed posture',
      'Cool down before stopping',
    ],
    primaryMuscles: ['quads', 'hamstrings', 'calves'],
    secondaryMuscles: ['glutes'],
  },
  {
    name: 'Rowing (Machine)',
    muscleGroup: 'Cardio',
    equipment: 'Machine',
    measurementKind: 'distance_time',
    description:
      'Full-body ergometer rowing — legs, back and arms — logged by distance and time.',
    cues: [
      'Drive with the legs first',
      'Then swing the back, then pull the arms',
      'Reverse the order on the recovery',
      'Keep a smooth 1:2 drive-to-recovery rhythm',
    ],
    primaryMuscles: ['lats', 'quads'],
    secondaryMuscles: ['hamstrings', 'glutes', 'biceps', 'lower_back'],
  },
  {
    name: 'Stationary Bike',
    muscleGroup: 'Cardio',
    equipment: 'Machine',
    measurementKind: 'duration',
    description:
      'Seated cycling for steady-state or intervals — logged by time.',
    cues: [
      'Set the saddle height to a slight knee bend',
      'Keep a steady cadence',
      'Push and pull through the full pedal stroke',
      'Adjust resistance to your target effort',
    ],
    primaryMuscles: ['quads'],
    secondaryMuscles: ['hamstrings', 'glutes', 'calves'],
  },
  {
    name: 'Jump Rope',
    muscleGroup: 'Cardio',
    equipment: 'Bodyweight',
    measurementKind: 'duration',
    description: 'A conditioning staple — continuous skipping logged by time.',
    cues: [
      'Elbows close, let the wrists do the turning',
      'Small, quick jumps off the balls of the feet',
      'Stay light and rhythmic',
      'Keep your gaze forward',
    ],
    primaryMuscles: ['calves'],
    secondaryMuscles: ['quads', 'forearms'],
  },
];

/**
 * One-time normalization of the original (pre-convention) seed names to their
 * canonical `CATALOG` names. Applied in place so the row keeps its `id` — and
 * thus its logged sets and routine references. Only non-custom rows are touched,
 * and only when the canonical name isn't already present, which keeps re-runs
 * no-ops and never clobbers a user-created exercise.
 */
const RENAMES: readonly { from: string; to: string }[] = [
  { from: 'Barbell Back Squat', to: 'Back Squat (Barbell)' },
  { from: 'Leg Press', to: 'Leg Press (Machine)' },
  { from: 'Bench Press', to: 'Bench Press (Barbell)' },
  { from: 'Incline Dumbbell Press', to: 'Incline Bench Press (Dumbbell)' },
  { from: 'Bent-over Row', to: 'Bent-Over Row (Barbell)' },
  { from: 'Lat Pulldown', to: 'Lat Pulldown (Cable)' },
  { from: 'Overhead Press', to: 'Overhead Press (Barbell)' },
  { from: 'Lateral Raise', to: 'Lateral Raise (Dumbbell)' },
  { from: 'Bicep Curl', to: 'Bicep Curl (Dumbbell)' },
  { from: 'Tricep Pushdown', to: 'Tricep Pushdown (Cable)' },
];

/**
 * Reconciles the default exercise catalog. Idempotent: renames legacy seed rows
 * to the canonical convention, then inserts any canonical exercise still
 * missing. Runs on every launch (see `runModuleSeeds`), so catalog additions
 * reach already-seeded devices without a reset and re-runs are no-ops.
 */
export function seedGym(db: AppDatabase): void {
  const canonicalByName = new Map(CATALOG.map((entry) => [entry.name, entry]));

  db.transaction((tx) => {
    const rows = tx
      .select({ name: exercises.name, isCustom: exercises.isCustom })
      .from(exercises)
      .all();
    const present = new Set(rows.map((row) => row.name));
    // Only seeded (non-custom) rows are eligible for renaming, so a user's own
    // exercise that happens to share a legacy name is never touched — and never
    // suppresses the canonical insert.
    const legacySeeded = new Set(
      rows.filter((row) => !row.isCustom).map((row) => row.name),
    );

    // 1) Normalize legacy names to canonical (non-custom rows, no collision).
    for (const { from, to } of RENAMES) {
      if (!legacySeeded.has(from) || present.has(to)) continue;
      const canonical = canonicalByName.get(to);
      if (!canonical) continue;
      tx.update(exercises)
        .set({
          name: canonical.name,
          muscleGroup: canonical.muscleGroup,
          equipment: canonical.equipment,
        })
        .where(and(eq(exercises.name, from), eq(exercises.isCustom, false)))
        .run();
      present.delete(from);
      present.add(to);
    }

    // 2) Insert any canonical exercise that isn't present yet.
    const missing = CATALOG.filter((entry) => !present.has(entry.name));
    if (missing.length > 0) {
      tx.insert(exercises)
        .values(
          missing.map((entry) => ({
            name: entry.name,
            muscleGroup: entry.muscleGroup,
            equipment: entry.equipment,
            measurementKind: entry.measurementKind ?? 'weight_reps',
            description: entry.description,
            cues: entry.cues,
            primaryMuscles: entry.primaryMuscles,
            secondaryMuscles: entry.secondaryMuscles,
            isCustom: false,
          })),
        )
        .run();
    }

    // 3) Reconcile catalog content onto already-seeded rows — measurementKind and
    // the later-added detail fields (description, cues, muscles) all backfill here
    // so existing devices get them without a reset. `isFavorite` is user state and
    // is deliberately never written, so favourites survive a reseed.
    for (const entry of CATALOG) {
      tx.update(exercises)
        .set({
          measurementKind: entry.measurementKind ?? 'weight_reps',
          description: entry.description,
          cues: entry.cues,
          primaryMuscles: entry.primaryMuscles,
          secondaryMuscles: entry.secondaryMuscles,
        })
        .where(
          and(eq(exercises.name, entry.name), eq(exercises.isCustom, false)),
        )
        .run();
    }
  });
}

/**
 * Seeds the per-muscle volume landmarks. Insert-or-IGNORE (not upsert): users
 * can now edit their own bands in the landmark editor, so re-seeding on every
 * launch must NOT clobber those edits — it only fills in muscles that have no
 * row yet. "Reset to defaults" (`resetMuscleLandmarks`) is the explicit way to
 * re-apply `DEFAULT_MUSCLE_LANDMARKS`. Runs on every launch (see `seedGymModule`).
 */
export function seedMuscleLandmarks(db: AppDatabase): void {
  db.transaction((tx) => {
    for (const [muscleGroup, b] of Object.entries(DEFAULT_MUSCLE_LANDMARKS)) {
      tx.insert(muscleLandmarks)
        .values({ muscleGroup, mv: b.mv, mev: b.mev, mav: b.mav, mrv: b.mrv })
        .onConflictDoNothing()
        .run();
    }
  });
}
