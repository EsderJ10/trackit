import type { AppDatabase } from '@/core/db/client';

import { exercises } from './schema';

interface SeedExercise {
  name: string;
  muscleGroup: string;
  equipment: string;
}

const CATALOG: readonly SeedExercise[] = [
  { name: 'Barbell Back Squat', muscleGroup: 'Legs', equipment: 'Barbell' },
  { name: 'Romanian Deadlift', muscleGroup: 'Legs', equipment: 'Barbell' },
  { name: 'Leg Press', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { name: 'Push-up', muscleGroup: 'Chest', equipment: 'Bodyweight' },
  { name: 'Deadlift', muscleGroup: 'Back', equipment: 'Barbell' },
  { name: 'Pull-up', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { name: 'Bent-over Row', muscleGroup: 'Back', equipment: 'Barbell' },
  { name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Machine' },
  { name: 'Overhead Press', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { name: 'Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Bicep Curl', muscleGroup: 'Arms', equipment: 'Dumbbell' },
  { name: 'Tricep Pushdown', muscleGroup: 'Arms', equipment: 'Cable' },
  { name: 'Plank', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { name: 'Hanging Leg Raise', muscleGroup: 'Core', equipment: 'Bodyweight' },
];

/** Seeds the default exercise catalog. Runs once (guarded by the seed runner). */
export async function seedGym(db: AppDatabase): Promise<void> {
  await db
    .insert(exercises)
    .values(CATALOG.map((exercise) => ({ ...exercise, isCustom: false })))
    .run();
}
