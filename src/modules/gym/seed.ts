import { and, eq } from 'drizzle-orm';

import type { AppDatabase } from '@/core/db/client';

import { exercises } from './schema';

interface SeedExercise {
  name: string;
  muscleGroup: string;
  equipment: string;
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
  { name: 'Back Squat (Barbell)', muscleGroup: 'Legs', equipment: 'Barbell' },
  { name: 'Romanian Deadlift', muscleGroup: 'Legs', equipment: 'Barbell' },
  { name: 'Leg Press (Machine)', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Leg Extension (Machine)', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Leg Curl (Machine)', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Seated Leg Curl (Machine)', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Hip Abduction (Machine)', muscleGroup: 'Legs', equipment: 'Machine' },
  // Chest
  { name: 'Bench Press (Barbell)', muscleGroup: 'Chest', equipment: 'Barbell' },
  { name: 'Bench Press (Dumbbell)', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { name: 'Bench Press (Smith)', muscleGroup: 'Chest', equipment: 'Machine' },
  { name: 'Incline Bench Press (Barbell)', muscleGroup: 'Chest', equipment: 'Barbell' },
  { name: 'Incline Bench Press (Dumbbell)', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { name: 'Seated Chest Press (Machine)', muscleGroup: 'Chest', equipment: 'Machine' },
  { name: 'Pec Deck Fly', muscleGroup: 'Chest', equipment: 'Machine' },
  { name: 'Push-up', muscleGroup: 'Chest', equipment: 'Bodyweight' },
  // Back
  { name: 'Deadlift', muscleGroup: 'Back', equipment: 'Barbell' },
  { name: 'Pull-up', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { name: 'Bent-Over Row (Barbell)', muscleGroup: 'Back', equipment: 'Barbell' },
  { name: 'Lat Pulldown (Cable)', muscleGroup: 'Back', equipment: 'Cable' },
  { name: 'Seated Lat Pulldown (Machine)', muscleGroup: 'Back', equipment: 'Machine' },
  { name: 'Chest-Supported Row (Machine)', muscleGroup: 'Back', equipment: 'Machine' },
  { name: 'T-Bar Row', muscleGroup: 'Back', equipment: 'Machine' },
  { name: 'Single-Arm Dumbbell Row', muscleGroup: 'Back', equipment: 'Dumbbell' },
  // Shoulders
  { name: 'Overhead Press (Barbell)', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { name: 'Overhead Press (Dumbbell)', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Lateral Raise (Dumbbell)', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  // Arms
  { name: 'Bicep Curl (Dumbbell)', muscleGroup: 'Arms', equipment: 'Dumbbell' },
  { name: 'Bicep Curl (EZ-Bar)', muscleGroup: 'Arms', equipment: 'Barbell' },
  { name: 'Tricep Pushdown (Cable)', muscleGroup: 'Arms', equipment: 'Cable' },
  { name: 'Overhead Triceps Extension (Dumbbell)', muscleGroup: 'Arms', equipment: 'Dumbbell' },
  // Core
  { name: 'Plank', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { name: 'Hanging Leg Raise', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { name: 'Crunch', muscleGroup: 'Core', equipment: 'Bodyweight' },
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
        .values(missing.map((entry) => ({ ...entry, isCustom: false })))
        .run();
    }
  });
}
