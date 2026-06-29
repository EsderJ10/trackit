import { and, eq } from 'drizzle-orm';

import type { AppDatabase } from '@/core/db/client';

import { DEFAULT_MUSCLE_LANDMARKS } from './landmarks';
import type { Muscle } from './muscles';
import { exercises, muscleLandmarks } from './schema';
import type { MeasurementKind } from './schema';

type Mechanic = 'compound' | 'isolation';
type ForceType = 'push' | 'pull' | 'static';

interface SeedExercise {
  name: string;
  muscleGroup: string;
  equipment: string;
  /** Defaults to 'weight_reps' when omitted. */
  measurementKind?: MeasurementKind;
  /** Multi-joint (compound) vs single-joint (isolation). */
  mechanic: Mechanic;
  /** Resistance direction. Omit where push/pull/static doesn't fit (rotation). */
  forceType?: ForceType;
  /** One-line summary shown atop the detail screen. */
  description: string;
  /** Ordered form cues (setup → execution). */
  cues: string[];
  /** Frequent errors, rendered as a cautionary list under the cues. */
  commonMistakes: string[];
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
 * `equipment` stays within the existing 5 values (Barbell, Dumbbell, Machine,
 * Cable, Bodyweight); the parenthetical name carries finer detail (Smith bench →
 * name `(Smith)`, equipment `Machine`; EZ-bar curl → name `(EZ-Bar)`, equipment
 * `Barbell`).
 *
 * Muscle tags are anatomically literal — a lateral raise tags `side_delts`, an
 * EZ-bar curl tags `brachialis`, a hanging leg raise tags `hip_flexors` — so the
 * anatomy diagram and a knowledgeable lifter both read them as true.
 */
const CATALOG: readonly SeedExercise[] = [
  // Legs
  {
    name: 'Back Squat (Barbell)',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A barbell racked on the upper back and squatted to depth — the foundational lower-body strength builder.',
    cues: [
      'Rack the bar across your upper traps and brace your core hard',
      'Break at the hips and knees together',
      'Sink to at least parallel, knees tracking over the toes',
      'Drive through the midfoot to stand tall',
    ],
    commonMistakes: [
      'Letting the knees cave inward on the way up',
      'Cutting depth short — stopping well above parallel',
      'Rounding the lower back at the bottom',
    ],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'adductors', 'lower_back', 'abs'],
  },
  {
    name: 'Front Squat (Barbell)',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A barbell racked on the front delts and squatted upright — biases the quads and demands a tall torso.',
    cues: [
      'Rest the bar on the front delts, elbows high',
      'Keep the torso vertical as you descend',
      'Sink to depth with the knees tracking the toes',
      'Drive up without letting the elbows drop',
    ],
    commonMistakes: [
      'Elbows dropping, which dumps the bar forward',
      'Leaning forward and turning it into a good morning',
      'Rising onto the toes instead of the midfoot',
    ],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['abs', 'adductors', 'lower_back'],
  },
  {
    name: 'Goblet Squat (Dumbbell)',
    muscleGroup: 'Legs',
    equipment: 'Dumbbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A squat holding one dumbbell at the chest — the most beginner-friendly way to learn the pattern.',
    cues: [
      'Cup one end of the dumbbell against your chest',
      'Sit straight down between your hips',
      'Keep the chest up and elbows inside the knees',
      'Drive through the midfoot to stand',
    ],
    commonMistakes: [
      'Letting the chest collapse forward',
      'Heels lifting off the floor',
      'Going too light to actually challenge the legs',
    ],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['adductors', 'abs'],
  },
  {
    name: 'Deadlift',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'The full-body pull — lifting a loaded barbell from the floor to a standing lockout.',
    cues: [
      'Bar over the midfoot, shins close',
      'Flat back, chest up, brace hard',
      'Push the floor away and drag the bar up',
      'Lock out the hips and knees together',
    ],
    commonMistakes: [
      'Rounding the lower back instead of hinging',
      'Letting the hips shoot up before the bar moves',
      'Jerking the bar off the floor rather than building tension',
    ],
    primaryMuscles: ['glutes', 'hamstrings', 'quads', 'lower_back'],
    secondaryMuscles: ['traps', 'lats', 'forearms', 'adductors'],
  },
  {
    name: 'Romanian Deadlift',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'A hip-hinge with near-straight legs that loads the hamstrings and glutes through a deep stretch.',
    cues: [
      'Soft knees, push the hips back',
      'Keep the bar dragging close to your legs',
      'Lower until you feel a hamstring stretch',
      'Squeeze the glutes to drive the hips forward',
    ],
    commonMistakes: [
      'Bending the knees and turning it into a deadlift',
      'Rounding the back to chase more range',
      'Letting the bar drift away from the legs',
    ],
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back', 'forearms', 'adductors'],
  },
  {
    name: 'Good Morning (Barbell)',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'A barbell hinge with the bar on the back — trains the hamstrings, glutes and spinal erectors.',
    cues: [
      'Bar on the upper back, soft knees',
      'Push the hips back, hinging the torso forward',
      'Stop when the hamstrings reach a strong stretch',
      'Drive the hips forward to stand tall',
    ],
    commonMistakes: [
      'Squatting down instead of hinging back',
      'Going too heavy and losing the flat back',
      'Hyperextending the lower back at the top',
    ],
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower_back', 'adductors'],
  },
  {
    name: 'Hip Thrust (Barbell)',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A bench-supported hip extension driving a loaded barbell up — the heaviest-loadable glute builder.',
    cues: [
      'Upper back on the bench, bar over the hips',
      'Tuck the chin and ribs down',
      'Drive through the heels to full hip extension',
      'Squeeze the glutes hard at the top',
    ],
    commonMistakes: [
      'Arching the lower back instead of extending the hips',
      'Pushing through the toes rather than the heels',
      'Cutting the lockout short of full extension',
    ],
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings', 'quads'],
  },
  {
    name: 'Leg Press (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A machine press that overloads the quads and glutes with the spine fully supported.',
    cues: [
      'Feet shoulder-width on the platform',
      'Lower until the knees reach about 90°',
      "Don't let the lower back round off the pad",
      'Press up without snapping the knees locked',
    ],
    commonMistakes: [
      'Lowering so far the hips curl off the seat',
      'Locking the knees hard at the top',
      'Bouncing out of the bottom',
    ],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'adductors'],
  },
  {
    name: 'Leg Extension (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    mechanic: 'isolation',
    forceType: 'push',
    description:
      'A seated isolation that targets the quads through full knee extension.',
    cues: [
      'Align the knee with the machine pivot',
      'Extend to a straight leg and pause briefly',
      'Lower under control',
      'Avoid swinging the weight up',
    ],
    commonMistakes: [
      'Using momentum to kick the weight up',
      'Letting the weight stack slam down each rep',
      'Setting the pivot out of line with the knee',
    ],
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
  },
  {
    name: 'Leg Curl (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    mechanic: 'isolation',
    forceType: 'pull',
    description:
      'A lying isolation that flexes the knee to target the hamstrings.',
    cues: [
      'Pad set just above the heels',
      'Curl fully toward your glutes',
      'Keep the hips pressed into the bench',
      "Lower slowly, don't let it slam",
    ],
    commonMistakes: [
      'Lifting the hips off the pad to cheat the weight up',
      'Cutting the range short of a full curl',
      'Dropping the weight on the way down',
    ],
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves'],
  },
  {
    name: 'Seated Leg Curl (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    mechanic: 'isolation',
    forceType: 'pull',
    description:
      'A seated knee-flexion curl that trains the hamstrings in a lengthened position.',
    cues: [
      'Thigh pad locked snug over the legs',
      'Curl down and back as far as possible',
      'Pause at peak contraction',
      'Control the stretch on the way up',
    ],
    commonMistakes: [
      'Sliding forward so the thigh pad rides up',
      'Bouncing at the bottom of the curl',
      'Shortening the range to use more weight',
    ],
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves'],
  },
  {
    name: 'Hip Abduction (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    mechanic: 'isolation',
    description:
      'A seated machine that pushes the knees apart to target the glute medius and outer hips.',
    cues: [
      'Sit tall against the back pad',
      'Press the knees outward to full range',
      'Pause at the widest point',
      'Return slowly without bouncing',
    ],
    commonMistakes: [
      'Leaning the torso to swing the weight out',
      'Snapping back in without control',
      'Using a range so short the glutes never load',
    ],
    primaryMuscles: ['glute_med'],
    secondaryMuscles: ['glutes'],
  },
  {
    name: 'Bulgarian Split Squat',
    muscleGroup: 'Legs',
    equipment: 'Dumbbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A rear-foot-elevated single-leg squat that hammers the quads and glutes one side at a time.',
    cues: [
      'Back foot on the bench, weight on the front leg',
      'Drop straight down, front shin near vertical',
      'Keep your torso tall',
      'Drive through the front heel to rise',
    ],
    commonMistakes: [
      'Pushing off the back foot instead of the front leg',
      'Letting the front knee cave inward',
      'Standing too close to the bench, cramping the depth',
    ],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'adductors'],
  },
  {
    name: 'Seated Calf Raise (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    mechanic: 'isolation',
    forceType: 'push',
    description:
      'A bent-knee seated raise that isolates the soleus of the calf.',
    cues: [
      'Pad on the lower thighs, balls of the feet on the platform',
      'Drop the heels for a full stretch',
      'Press up onto the toes',
      'Pause and squeeze at the top',
    ],
    commonMistakes: [
      'Bouncing through partial reps',
      'Skipping the deep stretch at the bottom',
      'Rushing — calves respond to a controlled tempo',
    ],
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
  },
  {
    name: 'Standing Calf Raise (Machine)',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    mechanic: 'isolation',
    forceType: 'push',
    description:
      'A straight-leg standing raise that biases the gastrocnemius of the calf.',
    cues: [
      'Shoulders under the pads, balls of the feet on the platform',
      'Keep the knees straight throughout',
      'Drop the heels for a full stretch',
      'Press up tall onto the toes and squeeze',
    ],
    commonMistakes: [
      'Bending the knees, which shifts work to the soleus',
      'Cutting the range with quick bouncy reps',
      'Not pausing at the top or bottom',
    ],
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
  },
  // Chest
  {
    name: 'Bench Press (Barbell)',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'The benchmark horizontal press — a barbell driven off the chest to build pressing strength.',
    cues: [
      'Shoulder blades pinched, slight arch',
      'Lower the bar to mid-chest',
      'Elbows tucked to about 45–75°, not flared wide',
      'Press up and slightly back over the shoulders',
    ],
    commonMistakes: [
      'Flaring the elbows straight out to 90°',
      'Bouncing the bar off the chest',
      'Letting the shoulders round forward off the bench',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts'],
  },
  {
    name: 'Bench Press (Dumbbell)',
    muscleGroup: 'Chest',
    equipment: 'Dumbbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A dumbbell bench press allowing a deeper stretch and independent arm work.',
    cues: [
      'Start with the dumbbells over the chest',
      'Lower to chest level with a stretch',
      'Keep the wrists stacked over the elbows',
      'Press up without clashing the bells',
    ],
    commonMistakes: [
      'Letting the dumbbells drift toward the head',
      'Cutting the stretch short at the bottom',
      'Pressing unevenly so one arm leads',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts'],
  },
  {
    name: 'Bench Press (Smith)',
    muscleGroup: 'Chest',
    equipment: 'Machine',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A fixed-bar bench press on the Smith machine for a stable pressing groove.',
    cues: [
      'Set the bar to touch mid-chest',
      'Unrack and brace',
      'Lower under control to the chest',
      'Press straight up the fixed track',
    ],
    commonMistakes: [
      'Lying too high or low so the bar misses mid-chest',
      'Forgetting to re-rack by twisting the wrists',
      'Bouncing the bar off the chest',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts'],
  },
  {
    name: 'Incline Bench Press (Barbell)',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A barbell press on an inclined bench that biases the upper chest.',
    cues: [
      'Bench set to about 30°',
      'Lower the bar to the upper chest near the collarbone',
      'Keep the elbows under the bar',
      'Press up over the shoulders',
    ],
    commonMistakes: [
      'Setting the bench too steep, turning it into a shoulder press',
      'Lowering the bar too low toward the belly',
      'Flaring the elbows wide',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
  },
  {
    name: 'Incline Bench Press (Dumbbell)',
    muscleGroup: 'Chest',
    equipment: 'Dumbbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'An incline dumbbell press emphasising the upper chest with a long stretch.',
    cues: [
      'Bench at about 30°, dumbbells over the upper chest',
      'Lower to a deep stretch at chest level',
      'Wrists stacked over the elbows',
      'Press up and slightly together',
    ],
    commonMistakes: [
      'Setting too steep an incline',
      'Clashing the dumbbells at the top',
      'Letting the elbows drop below the bench line uncontrolled',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts', 'triceps'],
  },
  {
    name: 'Seated Chest Press (Machine)',
    muscleGroup: 'Chest',
    equipment: 'Machine',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A seated machine press that trains the chest on a fixed, beginner-friendly path.',
    cues: [
      'Set the seat so the handles sit at mid-chest',
      'Press out without locking hard',
      'Squeeze the chest at full reach',
      'Return until you feel a stretch',
    ],
    commonMistakes: [
      'Seat set too high or low, shifting work off the chest',
      'Letting the weight stack rest between reps',
      'Shrugging the shoulders up to press',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts'],
  },
  {
    name: 'Pec Deck Fly',
    muscleGroup: 'Chest',
    equipment: 'Machine',
    mechanic: 'isolation',
    forceType: 'push',
    description:
      'A seated fly machine that isolates the chest through horizontal adduction.',
    cues: [
      'Forearms on the pads, slight elbow bend',
      'Bring the pads together in front',
      'Squeeze the chest in the middle',
      'Open slowly to a stretch',
    ],
    commonMistakes: [
      'Pressing with the arms instead of squeezing the chest',
      'Letting the weight yank the arms back too far',
      'Shrugging the shoulders forward',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts'],
  },
  {
    name: 'Cable Fly',
    muscleGroup: 'Chest',
    equipment: 'Cable',
    mechanic: 'isolation',
    forceType: 'push',
    description:
      'A standing cable fly that isolates the chest with constant tension across the arc.',
    cues: [
      'Pulleys set high or at shoulder height, slight forward lean',
      'Soft elbows held at a fixed angle',
      'Sweep the hands together in a hugging arc',
      'Squeeze, then open slowly to a stretch',
    ],
    commonMistakes: [
      'Bending the elbows and turning it into a press',
      'Using momentum from the torso',
      'Letting the cables pull the arms back past a safe stretch',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['front_delts'],
  },
  {
    name: 'Push-up',
    muscleGroup: 'Chest',
    equipment: 'Bodyweight',
    measurementKind: 'bodyweight',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A scalable bodyweight horizontal press for the chest, triceps and core.',
    cues: [
      'Hands just wider than the shoulders',
      'Body in a straight line, brace the core',
      'Lower until the chest nearly touches',
      "Press up, don't let the hips sag",
    ],
    commonMistakes: [
      'Letting the hips sag or pike up',
      'Flaring the elbows out to 90°',
      'Cutting the depth short',
    ],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'front_delts', 'abs'],
  },
  {
    name: 'Dips',
    muscleGroup: 'Chest',
    equipment: 'Bodyweight',
    measurementKind: 'bodyweight',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A bodyweight press between parallel bars — lean forward for chest, stay upright for triceps.',
    cues: [
      'Start at the top with the arms locked',
      'Lean the torso forward to bias the chest',
      'Lower until the upper arms reach parallel',
      'Press back up to a strong lockout',
    ],
    commonMistakes: [
      'Dropping too deep and straining the shoulders',
      'Bouncing out of the bottom',
      'Shrugging the shoulders up to the ears',
    ],
    primaryMuscles: ['chest', 'triceps'],
    secondaryMuscles: ['front_delts'],
  },
  // Back
  {
    name: 'Pull-up',
    muscleGroup: 'Back',
    equipment: 'Bodyweight',
    measurementKind: 'bodyweight',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'A bodyweight vertical pull — hanging from a bar and pulling the chin over it.',
    cues: [
      'Overhand grip just wider than the shoulders',
      'Start from a full dead hang',
      'Drive the elbows down and back',
      'Pull the chin over the bar, lower with control',
    ],
    commonMistakes: [
      'Kipping or swinging to generate momentum',
      'Cutting the range short of a full hang',
      'Shrugging instead of driving the elbows down',
    ],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'traps', 'rear_delts', 'forearms'],
  },
  {
    name: 'Bent-Over Row (Barbell)',
    muscleGroup: 'Back',
    equipment: 'Barbell',
    mechanic: 'compound',
    forceType: 'pull',
    description: 'A hinged barbell row that builds mid-back thickness.',
    cues: [
      'Hinge to about 45°, flat back',
      "Let the bar hang at arm's length",
      'Row to the lower ribs or belly',
      'Squeeze the shoulder blades, lower slow',
    ],
    commonMistakes: [
      'Standing too upright and turning it into a shrug',
      'Rounding the lower back',
      'Heaving the weight with the hips each rep',
    ],
    primaryMuscles: ['lats', 'traps'],
    secondaryMuscles: ['rear_delts', 'biceps', 'lower_back'],
  },
  {
    name: 'Lat Pulldown (Cable)',
    muscleGroup: 'Back',
    equipment: 'Cable',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'A cable vertical pull that trains the lats with adjustable load — a pull-up regression.',
    cues: [
      'Grip wider than the shoulders, chest up',
      'Pull the bar to your upper chest',
      'Drive the elbows down toward your hips',
      'Control the bar back to a full stretch',
    ],
    commonMistakes: [
      'Leaning way back and using the whole body',
      'Pulling the bar behind the neck',
      'Letting the weight yank the arms up between reps',
    ],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'rear_delts', 'traps'],
  },
  {
    name: 'Seated Lat Pulldown (Machine)',
    muscleGroup: 'Back',
    equipment: 'Machine',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'A machine pulldown with the torso braced against pads for stable vertical pulling.',
    cues: [
      'Lock the thigh pads snug',
      'Pull the handles to your collarbone',
      'Lead with the elbows',
      'Return to a full overhead stretch',
    ],
    commonMistakes: [
      'Using a short, partial range',
      'Curling with the arms instead of driving the elbows',
      'Letting the shoulders shrug up under load',
    ],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'rear_delts'],
  },
  {
    name: 'Seated Cable Row',
    muscleGroup: 'Back',
    equipment: 'Cable',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'A seated horizontal cable pull that builds mid-back thickness with constant tension.',
    cues: [
      'Sit tall, slight bend at the knees',
      'Pull the handle to your belly',
      'Drive the elbows back and squeeze the blades',
      'Extend the arms fully to a stretch',
    ],
    commonMistakes: [
      'Rocking the torso back and forth for momentum',
      'Rounding the back on the stretch',
      'Shrugging the shoulders toward the ears',
    ],
    primaryMuscles: ['lats', 'traps'],
    secondaryMuscles: ['rear_delts', 'biceps'],
  },
  {
    name: 'Chest-Supported Row (Machine)',
    muscleGroup: 'Back',
    equipment: 'Machine',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'A row with the chest braced on a pad, removing lower-back strain to isolate the back.',
    cues: [
      'Chest flat on the pad',
      'Row the handles toward your hips',
      'Squeeze the shoulder blades together',
      'Extend the arms fully each rep',
    ],
    commonMistakes: [
      'Peeling the chest off the pad to cheat',
      'Cutting the squeeze short at the top',
      'Using only the arms instead of the back',
    ],
    primaryMuscles: ['lats', 'traps'],
    secondaryMuscles: ['rear_delts', 'biceps'],
  },
  {
    name: 'T-Bar Row',
    muscleGroup: 'Back',
    equipment: 'Machine',
    mechanic: 'compound',
    forceType: 'pull',
    description: 'A landmine T-bar row that loads heavy for mid-back mass.',
    cues: [
      'Hinge over the bar, flat back',
      'Pull the handles to your torso',
      'Drive the elbows past your ribs',
      'Lower under control to a stretch',
    ],
    commonMistakes: [
      'Standing too upright, shortening the range',
      'Rounding the back under heavy load',
      'Jerking the weight up with the legs',
    ],
    primaryMuscles: ['lats', 'traps'],
    secondaryMuscles: ['rear_delts', 'biceps', 'lower_back'],
  },
  {
    name: 'Single-Arm Dumbbell Row',
    muscleGroup: 'Back',
    equipment: 'Dumbbell',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'A one-arm braced row for unilateral back development and a long range of motion.',
    cues: [
      'One hand and knee on the bench',
      'Let the dumbbell hang fully',
      'Row to your hip, elbow close to the body',
      'Squeeze, then lower to a full stretch',
    ],
    commonMistakes: [
      'Twisting the torso open to swing the weight up',
      'Rowing high to the chest instead of the hip',
      'Using a short range that skips the stretch',
    ],
    primaryMuscles: ['lats', 'traps'],
    secondaryMuscles: ['rear_delts', 'biceps'],
  },
  // Shoulders
  {
    name: 'Overhead Press (Barbell)',
    muscleGroup: 'Shoulders',
    equipment: 'Barbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A standing barbell press overhead — the core builder for shoulder strength.',
    cues: [
      'Bar on the front delts, grip just outside the shoulders',
      'Brace the glutes and core',
      'Press up, move the head back then through',
      'Lock out with the bar stacked over the crown and midfoot',
    ],
    commonMistakes: [
      'Leaning back into the lower spine instead of bracing',
      'Pressing the bar out in front of the body',
      'Stopping short of a full overhead lockout',
    ],
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['side_delts', 'triceps', 'traps'],
  },
  {
    name: 'Overhead Press (Dumbbell)',
    muscleGroup: 'Shoulders',
    equipment: 'Dumbbell',
    mechanic: 'compound',
    forceType: 'push',
    description:
      'A seated or standing dumbbell shoulder press with a free range of motion.',
    cues: [
      'Dumbbells at shoulder height',
      'Press up without fully flaring the elbows',
      'Stop just short of clashing overhead',
      'Lower under control to ear level',
    ],
    commonMistakes: [
      'Lowering only halfway each rep',
      'Arching the lower back to press heavy',
      'Letting the dumbbells drift forward',
    ],
    primaryMuscles: ['front_delts'],
    secondaryMuscles: ['side_delts', 'triceps', 'traps'],
  },
  {
    name: 'Lateral Raise (Dumbbell)',
    muscleGroup: 'Shoulders',
    equipment: 'Dumbbell',
    mechanic: 'isolation',
    description:
      'An isolation raising the arms out to the sides for wider, capped side delts.',
    cues: [
      'Slight bend in the elbows',
      'Lead with the elbows, not the hands',
      'Raise to shoulder height, no higher',
      'Lower slowly — resist the drop',
    ],
    commonMistakes: [
      'Swinging the weight up with the whole body',
      'Shrugging the traps to lift the dumbbells',
      'Raising above shoulder height where the traps take over',
    ],
    primaryMuscles: ['side_delts'],
    secondaryMuscles: ['traps'],
  },
  {
    name: 'Cable Rear Delt Fly',
    muscleGroup: 'Shoulders',
    equipment: 'Cable',
    mechanic: 'isolation',
    forceType: 'pull',
    description:
      'A cross-body cable fly that isolates the rear delts and upper back.',
    cues: [
      'Cables set at shoulder height, arms crossed',
      'Pull out and back in a wide arc',
      'Keep a fixed slight elbow bend',
      'Squeeze the rear delts, return slow',
    ],
    commonMistakes: [
      'Bending the elbows to row instead of fly',
      'Using momentum from the torso',
      'Letting the shoulders roll forward',
    ],
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: ['traps'],
  },
  {
    name: 'Reverse Pec Deck',
    muscleGroup: 'Shoulders',
    equipment: 'Machine',
    mechanic: 'isolation',
    forceType: 'pull',
    description:
      'A seated reverse fly machine that isolates the rear delts and upper-back retractors.',
    cues: [
      'Chest on the pad, arms forward at shoulder height',
      'Sweep the handles out and back in a wide arc',
      'Squeeze the rear delts and shoulder blades',
      'Return slowly to the front',
    ],
    commonMistakes: [
      'Bending the elbows to turn it into a row',
      'Jerking the handles back with momentum',
      'Shrugging the upper traps to move the weight',
    ],
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: ['traps'],
  },
  {
    name: 'Face Pull (Cable)',
    muscleGroup: 'Shoulders',
    equipment: 'Cable',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'A high-cable rope pull to the face — builds the rear delts and upper back for shoulder health.',
    cues: [
      'Rope set above head height, lean back slightly',
      'Pull the rope toward your forehead',
      'Flare the elbows high and rotate the hands back',
      'Squeeze the rear delts, return under control',
    ],
    commonMistakes: [
      'Dropping the elbows so it becomes a row',
      'Going too heavy and using the lower back',
      'Pulling to the chest instead of the face',
    ],
    primaryMuscles: ['rear_delts'],
    secondaryMuscles: ['traps'],
  },
  // Arms
  {
    name: 'Biceps Curl (Dumbbell)',
    muscleGroup: 'Arms',
    equipment: 'Dumbbell',
    mechanic: 'isolation',
    forceType: 'pull',
    description: 'The classic dumbbell curl for the biceps, one arm or both.',
    cues: [
      'Elbows pinned to your sides',
      'Curl without swinging the torso',
      'Squeeze at the top',
      'Lower fully to a straight arm',
    ],
    commonMistakes: [
      'Swinging the body to heave the weight up',
      'Letting the elbows drift forward',
      'Stopping short of a full lockout at the bottom',
    ],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
  },
  {
    name: 'Biceps Curl (EZ-Bar)',
    muscleGroup: 'Arms',
    equipment: 'Barbell',
    mechanic: 'isolation',
    forceType: 'pull',
    description:
      'An angled-bar curl that is easier on the wrists while loading the biceps and brachialis.',
    cues: [
      'Grip the inner angles, elbows tucked',
      'Curl the bar up under control',
      'Keep the elbows still',
      'Lower all the way down',
    ],
    commonMistakes: [
      'Rocking the torso to swing the bar up',
      'Letting the elbows swing forward',
      'Half-repping instead of a full stretch and squeeze',
    ],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['brachialis', 'forearms'],
  },
  {
    name: 'Hammer Curl (Dumbbell)',
    muscleGroup: 'Arms',
    equipment: 'Dumbbell',
    mechanic: 'isolation',
    forceType: 'pull',
    description:
      'A neutral-grip curl that biases the brachialis and forearm for thicker arms.',
    cues: [
      'Palms facing each other, elbows pinned',
      'Curl straight up without rotating the wrist',
      'Squeeze at the top',
      'Lower fully under control',
    ],
    commonMistakes: [
      'Swinging the dumbbells up with the shoulders',
      'Letting the elbows drift forward',
      'Rushing the lowering phase',
    ],
    primaryMuscles: ['biceps', 'brachialis'],
    secondaryMuscles: ['forearms'],
  },
  {
    name: 'Preacher Curl (EZ-Bar)',
    muscleGroup: 'Arms',
    equipment: 'Barbell',
    mechanic: 'isolation',
    forceType: 'pull',
    description:
      'An EZ-bar curl over a preacher bench that locks the elbows in for strict biceps work.',
    cues: [
      'Upper arms flat on the pad',
      'Curl the bar up under control',
      'Squeeze hard at the top',
      'Lower to a near-straight arm, not a hard lockout',
    ],
    commonMistakes: [
      'Bouncing out of the bottom stretch',
      'Lifting the elbows off the pad',
      'Snapping the elbow straight under heavy load',
    ],
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['brachialis', 'forearms'],
  },
  {
    name: 'Triceps Pushdown (Cable)',
    muscleGroup: 'Arms',
    equipment: 'Cable',
    mechanic: 'isolation',
    forceType: 'push',
    description:
      'A cable pushdown that isolates the triceps with constant tension.',
    cues: [
      'Elbows pinned to your sides',
      'Push down to a full lockout',
      'Squeeze the triceps at the bottom',
      'Let the cable return without flaring the elbows',
    ],
    commonMistakes: [
      'Leaning over the bar to push with body weight',
      'Letting the elbows flare out and drift',
      'Cutting the range short of a full lockout',
    ],
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
  },
  {
    name: 'Overhead Triceps Extension (Dumbbell)',
    muscleGroup: 'Arms',
    equipment: 'Dumbbell',
    mechanic: 'isolation',
    forceType: 'push',
    description:
      'An overhead extension that loads the triceps long head through a deep stretch.',
    cues: [
      'Hold one dumbbell overhead with both hands',
      'Lower behind your head, elbows in',
      'Feel the stretch at the bottom',
      'Extend to lockout without flaring',
    ],
    commonMistakes: [
      'Flaring the elbows out wide',
      'Using a short range that skips the stretch',
      'Arching the lower back to press the weight',
    ],
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
  },
  {
    name: 'Skullcrusher (EZ-Bar)',
    muscleGroup: 'Arms',
    equipment: 'Barbell',
    mechanic: 'isolation',
    forceType: 'push',
    description:
      'A lying EZ-bar extension that loads all three triceps heads through a strong stretch.',
    cues: [
      'Lie back, bar over the forehead, elbows in',
      'Lower the bar toward the top of your head',
      'Keep the upper arms still',
      'Extend to lockout without flaring',
    ],
    commonMistakes: [
      'Flaring the elbows out under load',
      'Moving the upper arms instead of just the forearms',
      'Lowering toward the nose where it strains the elbows',
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
    mechanic: 'isolation',
    forceType: 'static',
    description:
      'An isometric hold that braces the entire core against gravity.',
    cues: [
      'Forearms under the shoulders',
      'Straight line from head to heels',
      'Squeeze the glutes and brace the abs',
      "Don't let the hips sag or pike",
    ],
    commonMistakes: [
      'Letting the hips sag toward the floor',
      'Piking the hips up to rest',
      'Holding the breath instead of breathing steadily',
    ],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
  },
  {
    name: 'Hanging Leg Raise',
    muscleGroup: 'Core',
    equipment: 'Bodyweight',
    measurementKind: 'bodyweight',
    mechanic: 'isolation',
    forceType: 'pull',
    description:
      'A hanging movement that raises the legs to train the lower abs and hip flexors.',
    cues: [
      'Dead hang, shoulders active',
      'Raise the legs to at least hip height',
      'Curl the pelvis up at the top to engage the abs',
      'Avoid swinging — lower slowly to a full hang',
    ],
    commonMistakes: [
      'Swinging the legs up with momentum',
      'Only lifting with the hip flexors, never curling the pelvis',
      'Dropping the legs fast instead of lowering with control',
    ],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['hip_flexors', 'obliques', 'forearms'],
  },
  {
    name: 'Crunch',
    muscleGroup: 'Core',
    equipment: 'Bodyweight',
    measurementKind: 'bodyweight',
    mechanic: 'isolation',
    forceType: 'pull',
    description: 'A short-range trunk flexion that isolates the abs.',
    cues: [
      'Lie back, knees bent',
      'Curl the shoulders off the floor',
      'Exhale and squeeze the abs',
      "Lower under control, don't yank the neck",
    ],
    commonMistakes: [
      'Pulling on the neck with the hands',
      'Using momentum to bounce up',
      'Lifting the whole back into a full sit-up',
    ],
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
  },
  {
    name: 'Cable Crunch',
    muscleGroup: 'Core',
    equipment: 'Cable',
    mechanic: 'isolation',
    forceType: 'pull',
    description:
      'A kneeling cable crunch that lets you load trunk flexion for the abs.',
    cues: [
      'Kneel facing the high pulley, rope by your head',
      'Hinge at the spine, curling the ribs to the hips',
      'Squeeze the abs hard at the bottom',
      'Rise under control without using the hips',
    ],
    commonMistakes: [
      'Rocking from the hips instead of crunching the spine',
      'Pulling the rope with the arms',
      'Using a range too short to load the abs',
    ],
    primaryMuscles: ['abs'],
    secondaryMuscles: ['obliques'],
  },
  {
    name: 'Russian Twist',
    muscleGroup: 'Core',
    equipment: 'Bodyweight',
    measurementKind: 'bodyweight',
    mechanic: 'isolation',
    description:
      'A seated rotational movement that trains the obliques side to side.',
    cues: [
      'Sit with the knees bent, torso leaned back',
      'Brace the core and keep the chest tall',
      'Rotate the torso to tap each side',
      'Move under control, not just the arms',
    ],
    commonMistakes: [
      'Only swinging the arms while the torso stays still',
      'Rounding the lower back as you lean',
      'Rushing reps and losing the rotation',
    ],
    primaryMuscles: ['obliques'],
    secondaryMuscles: ['abs'],
  },
  // Cardio — measured by distance+time or duration, not load×reps.
  {
    name: 'Treadmill Run',
    muscleGroup: 'Cardio',
    equipment: 'Machine',
    measurementKind: 'distance_time',
    mechanic: 'compound',
    description:
      'Steady or interval running on a treadmill — logged by distance and time.',
    cues: [
      'Warm up at an easy pace',
      'Land midfoot under your hips',
      'Keep an upright, relaxed posture',
      'Cool down before stopping',
    ],
    commonMistakes: [
      'Overstriding and landing heel-first ahead of the body',
      'Gripping the handrails, which cuts the effort',
      'Starting too fast with no warm-up',
    ],
    primaryMuscles: ['quads', 'hamstrings', 'glutes', 'calves'],
    secondaryMuscles: ['hip_flexors'],
  },
  {
    name: 'Rowing (Machine)',
    muscleGroup: 'Cardio',
    equipment: 'Machine',
    measurementKind: 'distance_time',
    mechanic: 'compound',
    forceType: 'pull',
    description:
      'Full-body ergometer rowing — legs, back and arms — logged by distance and time.',
    cues: [
      'Drive with the legs first',
      'Then swing the back, then pull the arms',
      'Reverse the order on the recovery',
      'Keep a smooth 1:2 drive-to-recovery rhythm',
    ],
    commonMistakes: [
      'Pulling with the arms before the legs drive',
      'Rounding the back at the catch',
      'Rushing the recovery and losing rhythm',
    ],
    primaryMuscles: ['quads', 'glutes', 'lats'],
    secondaryMuscles: ['hamstrings', 'biceps', 'lower_back'],
  },
  {
    name: 'Stationary Bike',
    muscleGroup: 'Cardio',
    equipment: 'Machine',
    measurementKind: 'duration',
    mechanic: 'compound',
    description:
      'Seated cycling for steady-state or intervals — logged by time.',
    cues: [
      'Set the saddle height to a slight knee bend',
      'Keep a steady cadence',
      'Push and pull through the full pedal stroke',
      'Adjust resistance to your target effort',
    ],
    commonMistakes: [
      'Saddle too low, cramping the knees',
      'Rocking the hips side to side at high resistance',
      'Pedaling with no resistance the whole session',
    ],
    primaryMuscles: ['quads'],
    secondaryMuscles: ['hamstrings', 'glutes', 'calves'],
  },
  {
    name: 'Jump Rope',
    muscleGroup: 'Cardio',
    equipment: 'Bodyweight',
    measurementKind: 'duration',
    mechanic: 'compound',
    description: 'A conditioning staple — continuous skipping logged by time.',
    cues: [
      'Elbows close, let the wrists do the turning',
      'Small, quick jumps off the balls of the feet',
      'Stay light and rhythmic',
      'Keep your gaze forward',
    ],
    commonMistakes: [
      'Jumping too high and tiring out fast',
      'Swinging the whole arms instead of the wrists',
      'Landing flat-footed and heavy',
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
 *
 * Chains are safe: a device on the oldest name (`Bicep Curl`) jumps straight to
 * the newest canonical, while a device already on an intermediate name
 * (`Bicep Curl (Dumbbell)`) is caught by its own entry. The `present.has(to)`
 * guard stops any double-apply.
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
  // "Bicep"/"Tricep" → anatomically-correct "Biceps"/"Triceps".
  { from: 'Bicep Curl', to: 'Biceps Curl (Dumbbell)' },
  { from: 'Bicep Curl (Dumbbell)', to: 'Biceps Curl (Dumbbell)' },
  { from: 'Bicep Curl (EZ-Bar)', to: 'Biceps Curl (EZ-Bar)' },
  { from: 'Tricep Pushdown', to: 'Triceps Pushdown (Cable)' },
  { from: 'Tricep Pushdown (Cable)', to: 'Triceps Pushdown (Cable)' },
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
      legacySeeded.delete(from);
      legacySeeded.add(to);
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
            mechanic: entry.mechanic,
            forceType: entry.forceType ?? null,
            description: entry.description,
            cues: entry.cues,
            commonMistakes: entry.commonMistakes,
            primaryMuscles: entry.primaryMuscles,
            secondaryMuscles: entry.secondaryMuscles,
            isCustom: false,
          })),
        )
        .run();
    }

    // 3) Reconcile catalog content onto already-seeded rows — measurementKind and
    // the later-added detail fields (description, cues, mechanic, forceType,
    // commonMistakes, muscles) all backfill here so existing devices get them
    // without a reset. `isFavorite` is user state and is deliberately never
    // written, so favourites survive a reseed.
    for (const entry of CATALOG) {
      tx.update(exercises)
        .set({
          muscleGroup: entry.muscleGroup,
          equipment: entry.equipment,
          measurementKind: entry.measurementKind ?? 'weight_reps',
          mechanic: entry.mechanic,
          forceType: entry.forceType ?? null,
          description: entry.description,
          cues: entry.cues,
          commonMistakes: entry.commonMistakes,
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
