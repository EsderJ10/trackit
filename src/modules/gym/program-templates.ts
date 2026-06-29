import { eq } from 'drizzle-orm';

import type { AppDatabase } from '@/core/db/client';
import { moduleSeedState } from '@/core/settings/schema';

import {
  exercises,
  exerciseTrainingState,
  programDays,
  programExercises,
  programs,
  programSets,
  programWeeks,
} from './schema';

// Built-in program templates showcasing the four schemes + the Days × Weeks
// roadmap. Seeded once per template (see `seedProgramTemplates`), not reconciled,
// so deletions stick. Exercises referenced by catalog name, resolved at seed time.

type SchemeType = 'lp' | 'dp' | 'percent' | 'rpe';

interface TemplateSet {
  reps: number;
  intensityKind: 'abs' | 'pct' | 'rpe';
  intensityValue: number;
  amrap?: boolean;
}

interface TemplateExercise {
  exercise: string;
  scheme: SchemeType;
  targetSets: number;
  incrementKg?: number;
  minReps?: number;
  maxReps?: number;
  failThreshold?: number;
  deloadPct?: number;
  tmIncrementKg?: number;
  targetRpe?: number;
  startingWeightKg?: number;
  startingReps?: number;
  trainingMaxKg?: number;
  e1rmKg?: number;
  /** Per-week prescriptions, keyed by 1-based week index (percent/rpe waves). */
  sets?: Record<number, TemplateSet[]>;
}

interface TemplateDay {
  name: string;
  exercises: TemplateExercise[];
}

interface ProgramTemplate {
  name: string;
  description: string;
  roundingStepKg?: number;
  weeks: { name: string; isDeload?: boolean }[];
  days: TemplateDay[];
}

// The classic 5/3/1 percentage wave (of training max).
const FIVE_THREE_ONE_WEEKS: Record<number, TemplateSet[]> = {
  1: [
    { reps: 5, intensityKind: 'pct', intensityValue: 0.65 },
    { reps: 5, intensityKind: 'pct', intensityValue: 0.75 },
    { reps: 5, intensityKind: 'pct', intensityValue: 0.85, amrap: true },
  ],
  2: [
    { reps: 3, intensityKind: 'pct', intensityValue: 0.7 },
    { reps: 3, intensityKind: 'pct', intensityValue: 0.8 },
    { reps: 3, intensityKind: 'pct', intensityValue: 0.9, amrap: true },
  ],
  3: [
    { reps: 5, intensityKind: 'pct', intensityValue: 0.75 },
    { reps: 3, intensityKind: 'pct', intensityValue: 0.85 },
    { reps: 1, intensityKind: 'pct', intensityValue: 0.95, amrap: true },
  ],
  4: [
    { reps: 5, intensityKind: 'pct', intensityValue: 0.4 },
    { reps: 5, intensityKind: 'pct', intensityValue: 0.5 },
    { reps: 5, intensityKind: 'pct', intensityValue: 0.6 },
  ],
};

/** A 5/3/1 main lift: 3 working sets per week + the per-cycle TM bump. */
function fiveThreeOne(
  exercise: string,
  trainingMaxKg: number,
  tmIncrementKg: number,
): TemplateExercise {
  return {
    exercise,
    scheme: 'percent',
    targetSets: 3,
    trainingMaxKg,
    tmIncrementKg,
    sets: FIVE_THREE_ONE_WEEKS,
  };
}

/** An RPE-autoregulated lift: `sets` × `reps` at a target RPE, anchored on e1RM. */
function rpeLift(
  exercise: string,
  e1rmKg: number,
  sets: number,
  reps: number,
  rpe: number,
): TemplateExercise {
  return {
    exercise,
    scheme: 'rpe',
    targetSets: sets,
    targetRpe: rpe,
    e1rmKg,
    sets: {
      1: Array.from({ length: sets }, () => ({
        reps,
        intensityKind: 'rpe' as const,
        intensityValue: rpe,
      })),
    },
  };
}

// 5-day PPLUL strength + hypertrophy mesocycle (4 accumulation weeks + 1 deload).
// Accessories anchor to a single working-week RPE so the e1RM re-anchor stays
// drift-free — a per-week RPE wave would mis-anchor pre-filled, RPE-less sets
// (see `[[gym-programs-design]]`).

const PPLUL_WEEKS: ProgramTemplate['weeks'] = [
  { name: 'Week 1 — Accumulate · RIR 4' },
  { name: 'Week 2 — Accumulate · RIR 3' },
  { name: 'Week 3 — Accumulate · RIR 2' },
  { name: 'Week 4 — Overreach · RIR 1' },
  { name: 'Week 5 — Deload', isDeload: true },
];

function pctSets(count: number, reps: number, pct: number): TemplateSet[] {
  return Array.from({ length: count }, () => ({
    reps,
    intensityKind: 'pct' as const,
    intensityValue: pct,
  }));
}

/** The heavy compound's 5-week wave: % of TM rising as reps fall, then a deload. */
const STRENGTH_WAVE: Record<number, TemplateSet[]> = {
  1: pctSets(3, 5, 0.8),
  2: pctSets(3, 5, 0.825),
  3: pctSets(3, 4, 0.85),
  4: pctSets(3, 3, 0.875),
  5: pctSets(2, 5, 0.5),
};

function strengthLift(
  exercise: string,
  trainingMaxKg: number,
  tmIncrementKg: number,
): TemplateExercise {
  return {
    exercise,
    scheme: 'percent',
    targetSets: 3,
    trainingMaxKg,
    tmIncrementKg,
    sets: STRENGTH_WAVE,
  };
}

/** Working-week accessory RPE — held constant so the e1RM re-anchor stays flat. */
const ACCESSORY_RPE = 8;
/** Per-week accessory set counts: ramp MEV→MRV (weeks 1–4), then deload. */
const ACCESSORY_SET_RAMP = [3, 4, 4, 5, 2] as const;

/**
 * Hypertrophy accessory: RPE-anchored sets at a fixed rep target whose weekly set
 * count ramps across the block, dropping to 2 lighter (RPE 5) sets on the deload.
 * The deload's lower RPE is safe because progression (re-anchor) is skipped there.
 */
function accessory(
  exercise: string,
  e1rmKg: number,
  reps: number,
): TemplateExercise {
  const sets: Record<number, TemplateSet[]> = {};
  ACCESSORY_SET_RAMP.forEach((count, index) => {
    const week = index + 1;
    const isDeload = week === ACCESSORY_SET_RAMP.length;
    sets[week] = Array.from({ length: count }, () => ({
      reps,
      intensityKind: 'rpe' as const,
      intensityValue: isDeload ? 5 : ACCESSORY_RPE,
    }));
  });
  return {
    exercise,
    scheme: 'rpe',
    targetSets: ACCESSORY_SET_RAMP[0],
    targetRpe: ACCESSORY_RPE,
    e1rmKg,
    sets,
  };
}

const TEMPLATES: ProgramTemplate[] = [
  {
    name: 'StrongLifts 5×5',
    description: 'Linear progression. Two alternating full-body days, A and B.',
    weeks: [{ name: 'Week 1' }],
    days: [
      {
        name: 'Workout A',
        exercises: [
          {
            exercise: 'Back Squat (Barbell)',
            scheme: 'lp',
            targetSets: 5,
            startingWeightKg: 40,
            startingReps: 5,
            incrementKg: 2.5,
          },
          {
            exercise: 'Bench Press (Barbell)',
            scheme: 'lp',
            targetSets: 5,
            startingWeightKg: 30,
            startingReps: 5,
            incrementKg: 2.5,
          },
          {
            exercise: 'Bent-Over Row (Barbell)',
            scheme: 'lp',
            targetSets: 5,
            startingWeightKg: 30,
            startingReps: 5,
            incrementKg: 2.5,
          },
        ],
      },
      {
        name: 'Workout B',
        exercises: [
          {
            exercise: 'Back Squat (Barbell)',
            scheme: 'lp',
            targetSets: 5,
            startingWeightKg: 40,
            startingReps: 5,
            incrementKg: 2.5,
          },
          {
            exercise: 'Overhead Press (Barbell)',
            scheme: 'lp',
            targetSets: 5,
            startingWeightKg: 20,
            startingReps: 5,
            incrementKg: 2.5,
          },
          {
            exercise: 'Deadlift',
            scheme: 'lp',
            targetSets: 1,
            startingWeightKg: 60,
            startingReps: 5,
            incrementKg: 5,
          },
        ],
      },
    ],
  },
  {
    name: 'Push / Pull / Legs',
    description: 'Double progression — climb the rep range, then add weight.',
    weeks: [{ name: 'Week 1' }],
    days: [
      {
        name: 'Push',
        exercises: [
          {
            exercise: 'Bench Press (Barbell)',
            scheme: 'dp',
            targetSets: 3,
            minReps: 6,
            maxReps: 10,
            startingWeightKg: 50,
            incrementKg: 2.5,
          },
          {
            exercise: 'Overhead Press (Barbell)',
            scheme: 'dp',
            targetSets: 3,
            minReps: 8,
            maxReps: 12,
            startingWeightKg: 30,
            incrementKg: 2.5,
          },
          {
            exercise: 'Tricep Pushdown (Cable)',
            scheme: 'dp',
            targetSets: 3,
            minReps: 10,
            maxReps: 15,
            startingWeightKg: 20,
            incrementKg: 2.5,
          },
        ],
      },
      {
        name: 'Pull',
        exercises: [
          {
            exercise: 'Bent-Over Row (Barbell)',
            scheme: 'dp',
            targetSets: 3,
            minReps: 6,
            maxReps: 10,
            startingWeightKg: 40,
            incrementKg: 2.5,
          },
          {
            exercise: 'Lat Pulldown (Cable)',
            scheme: 'dp',
            targetSets: 3,
            minReps: 8,
            maxReps: 12,
            startingWeightKg: 40,
            incrementKg: 2.5,
          },
          {
            exercise: 'Bicep Curl (Dumbbell)',
            scheme: 'dp',
            targetSets: 3,
            minReps: 10,
            maxReps: 15,
            startingWeightKg: 10,
            incrementKg: 2.5,
          },
        ],
      },
      {
        name: 'Legs',
        exercises: [
          {
            exercise: 'Back Squat (Barbell)',
            scheme: 'dp',
            targetSets: 3,
            minReps: 6,
            maxReps: 10,
            startingWeightKg: 60,
            incrementKg: 2.5,
          },
          {
            exercise: 'Romanian Deadlift',
            scheme: 'dp',
            targetSets: 3,
            minReps: 8,
            maxReps: 12,
            startingWeightKg: 50,
            incrementKg: 2.5,
          },
          {
            exercise: 'Leg Press (Machine)',
            scheme: 'dp',
            targetSets: 3,
            minReps: 10,
            maxReps: 15,
            startingWeightKg: 80,
            incrementKg: 5,
          },
        ],
      },
    ],
  },
  {
    name: '5/3/1',
    description:
      'Percentage of training max over a 4-week wave (3 working weeks + a deload). Training max bumps each cycle.',
    weeks: [
      { name: 'Week 1 — 5s' },
      { name: 'Week 2 — 3s' },
      { name: 'Week 3 — 5/3/1' },
      { name: 'Week 4 — Deload', isDeload: true },
    ],
    days: [
      {
        name: 'Overhead Press',
        exercises: [fiveThreeOne('Overhead Press (Barbell)', 40, 2.5)],
      },
      { name: 'Deadlift', exercises: [fiveThreeOne('Deadlift', 100, 5)] },
      {
        name: 'Bench Press',
        exercises: [fiveThreeOne('Bench Press (Barbell)', 60, 2.5)],
      },
      {
        name: 'Squat',
        exercises: [fiveThreeOne('Back Squat (Barbell)', 80, 5)],
      },
    ],
  },
  {
    name: 'RPE Strength',
    description:
      'Autoregulated — each lift’s load tracks your estimated 1RM at a target RPE, updated from what you actually log.',
    weeks: [{ name: 'Week 1' }],
    days: [
      {
        name: 'Upper',
        exercises: [
          rpeLift('Bench Press (Barbell)', 90, 4, 5, 8),
          rpeLift('Bent-Over Row (Barbell)', 80, 4, 6, 8),
          rpeLift('Overhead Press (Barbell)', 55, 3, 8, 8),
        ],
      },
      {
        name: 'Lower',
        exercises: [
          rpeLift('Back Squat (Barbell)', 110, 4, 5, 8),
          rpeLift('Deadlift', 130, 3, 4, 8),
          rpeLift('Romanian Deadlift', 90, 3, 8, 8),
        ],
      },
    ],
  },
  {
    name: '5-Day PPLUL — Strength + Hypertrophy',
    description:
      'A 5-week mesocycle (4 accumulation weeks + a deload) over a Push/Pull/Legs + Upper/Lower split — every major muscle trained 2×/week. Each day opens with a heavy compound on a percentage strength wave (load climbs 80→87.5% of training max as reps drop 5→3), then autoregulated hypertrophy accessories whose weekly set volume ramps up across the block and pulls back on the deload. Target effort descends RIR 4→3→2→1 week to week (see the week names). Note: the profile lumps quads/hams/calves under one “Legs” bar, so leg volume reads high — it’s within range per individual muscle.',
    roundingStepKg: 2.5,
    weeks: PPLUL_WEEKS,
    days: [
      {
        name: 'Legs',
        exercises: [
          strengthLift('Back Squat (Barbell)', 80, 5),
          accessory('Romanian Deadlift', 80, 8),
          accessory('Leg Press (Machine)', 175, 12),
          accessory('Leg Curl (Machine)', 50, 12),
          accessory('Seated Calf Raise (Machine)', 70, 15),
        ],
      },
      {
        name: 'Push',
        exercises: [
          strengthLift('Bench Press (Barbell)', 60, 2.5),
          accessory('Incline Bench Press (Dumbbell)', 34, 10),
          accessory('Overhead Press (Barbell)', 47, 8),
          accessory('Pec Deck Fly', 47, 15),
          accessory('Lateral Raise (Dumbbell)', 14, 15),
          accessory('Tricep Pushdown (Cable)', 37, 12),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          strengthLift('Chest-Supported Row (Machine)', 50, 2.5),
          accessory('T-Bar Row', 53, 8),
          accessory('Lat Pulldown (Cable)', 66, 12),
          accessory('Cable Rear Delt Fly', 19, 15),
          accessory('Bicep Curl (EZ-Bar)', 35, 10),
        ],
      },
      {
        name: 'Lower',
        exercises: [
          strengthLift('Deadlift', 100, 5),
          accessory('Leg Press (Machine)', 187, 8),
          accessory('Bulgarian Split Squat', 25, 10),
          accessory('Leg Extension (Machine)', 55, 15),
          accessory('Seated Calf Raise (Machine)', 70, 15),
        ],
      },
      {
        name: 'Upper',
        exercises: [
          strengthLift('Overhead Press (Barbell)', 40, 2.5),
          accessory('Incline Bench Press (Barbell)', 60, 8),
          accessory('Chest-Supported Row (Machine)', 63, 10),
          accessory('Lateral Raise (Dumbbell)', 13, 12),
          accessory('Bicep Curl (Dumbbell)', 20, 12),
          accessory('Overhead Triceps Extension (Dumbbell)', 25, 15),
        ],
      },
    ],
  },
];

/** Per-template seed marker (its own `module_seed_state` row). */
const templateMarker = (name: string) => `gym-tpl:${name}`;

/**
 * Insert each built-in template once, keyed by its own seed marker — so a deleted
 * template stays gone, yet templates added in a later version still reach an
 * already-seeded install. A name-existence guard avoids duplicating a markerless one.
 */
export function seedProgramTemplates(db: AppDatabase): void {
  const byName = new Map(
    db
      .select({ id: exercises.id, name: exercises.name })
      .from(exercises)
      .all()
      .map((row) => [row.name, row.id]),
  );

  for (const tpl of TEMPLATES) {
    const markerId = templateMarker(tpl.name);
    const seeded = db
      .select({ moduleId: moduleSeedState.moduleId })
      .from(moduleSeedState)
      .where(eq(moduleSeedState.moduleId, markerId))
      .all();
    if (seeded.length > 0) continue; // already seeded once → respect deletion

    db.transaction((tx) => {
      // Record the marker first so this template never re-seeds — even if its
      // build is skipped below because a same-named program already exists.
      tx.insert(moduleSeedState)
        .values({ moduleId: markerId, seededAt: new Date() })
        .onConflictDoNothing()
        .run();

      const exists = tx
        .select({ id: programs.id })
        .from(programs)
        .where(eq(programs.name, tpl.name))
        .all();
      if (exists.length > 0) return;

      const programId = tx
        .insert(programs)
        .values({
          name: tpl.name,
          description: tpl.description,
          lengthWeeks: tpl.weeks.length,
          roundingStepKg: tpl.roundingStepKg ?? 2.5,
        })
        .run().lastInsertRowId;

      tpl.weeks.forEach((week, index) => {
        tx.insert(programWeeks)
          .values({
            programId,
            weekIndex: index + 1,
            name: week.name,
            isDeload: week.isDeload ?? false,
          })
          .run();
      });

      tpl.days.forEach((day, dayIndex) => {
        const programDayId = tx
          .insert(programDays)
          .values({ programId, dayIndex, name: day.name })
          .run().lastInsertRowId;

        day.exercises.forEach((ex, position) => {
          const exerciseId = byName.get(ex.exercise);
          if (exerciseId == null) return; // catalog miss → skip defensively

          const programExerciseId = tx
            .insert(programExercises)
            .values({
              programId,
              programDayId,
              exerciseId,
              position,
              schemeType: ex.scheme,
              targetSets: ex.targetSets,
              incrementKg: ex.incrementKg ?? 2.5,
              minReps: ex.minReps ?? null,
              maxReps: ex.maxReps ?? null,
              failThreshold: ex.failThreshold ?? 3,
              deloadPct: ex.deloadPct ?? 0.1,
              tmIncrementKg: ex.tmIncrementKg ?? 2.5,
              targetRpe: ex.targetRpe ?? null,
            })
            .run().lastInsertRowId;

          tx.insert(exerciseTrainingState)
            .values({
              programExerciseId,
              currentWeightKg: ex.startingWeightKg ?? 0,
              currentReps: ex.startingReps ?? ex.minReps ?? 5,
              trainingMaxKg: ex.trainingMaxKg ?? null,
              e1rmKg: ex.e1rmKg ?? null,
              lastReason: 'Starting weight',
            })
            .run();

          if (ex.sets) {
            for (const [weekIndex, sets] of Object.entries(ex.sets)) {
              sets.forEach((set, i) => {
                tx.insert(programSets)
                  .values({
                    programExerciseId,
                    weekIndex: Number(weekIndex),
                    setNumber: i + 1,
                    reps: set.reps,
                    intensityKind: set.intensityKind,
                    intensityValue: set.intensityValue,
                    amrap: set.amrap ?? false,
                  })
                  .run();
              });
            }
          }
        });
      });
    });
  }
}
