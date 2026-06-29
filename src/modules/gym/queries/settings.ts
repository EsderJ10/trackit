import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/core/db/client';

import type { EffortScale } from '../effort';
import {
  DEFAULT_MUSCLE_LANDMARKS,
  type MuscleLandmarkBands,
} from '../landmarks';
import { gymSettings, muscleLandmarks } from '../schema';

// Gym settings: single row, id = 1.

const DEFAULT_REST_SEC = 120;

/** Default rest length (seconds), sync read; falls back to the default pre-write. */
export function getDefaultRestSec(): number {
  const row = db
    .select({ defaultRestSec: gymSettings.defaultRestSec })
    .from(gymSettings)
    .where(eq(gymSettings.id, 1))
    .all()[0];
  return row?.defaultRestSec ?? DEFAULT_REST_SEC;
}

export function setDefaultRestSec(defaultRestSec: number): void {
  db.insert(gymSettings)
    .values({ id: 1, defaultRestSec })
    .onConflictDoUpdate({ target: gymSettings.id, set: { defaultRestSec } })
    .run();
}

/** Live default rest length (seconds); falls back to the default pre-write. */
export function useDefaultRestSec(): number {
  const { data } = useLiveQuery(
    db
      .select({ defaultRestSec: gymSettings.defaultRestSec })
      .from(gymSettings)
      .where(eq(gymSettings.id, 1)),
  );
  return data[0]?.defaultRestSec ?? DEFAULT_REST_SEC;
}

const DEFAULT_WEEKLY_GOAL = 3;

/** Live target finished-workouts-per-week; falls back to the default pre-write. */
export function useWeeklyGoal(): number {
  const { data } = useLiveQuery(
    db
      .select({ weeklyWorkoutGoal: gymSettings.weeklyWorkoutGoal })
      .from(gymSettings)
      .where(eq(gymSettings.id, 1)),
  );
  return data[0]?.weeklyWorkoutGoal ?? DEFAULT_WEEKLY_GOAL;
}

export function setWeeklyGoal(weeklyWorkoutGoal: number): void {
  db.insert(gymSettings)
    .values({ id: 1, weeklyWorkoutGoal })
    .onConflictDoUpdate({ target: gymSettings.id, set: { weeklyWorkoutGoal } })
    .run();
}

const DEFAULT_EFFORT_SCALE: EffortScale = 'rpe';

/** Live effort scale (RPE/RIR) for the logging UI; defaults to RPE pre-write. */
export function useEffortScale(): EffortScale {
  const { data } = useLiveQuery(
    db
      .select({ effortScale: gymSettings.effortScale })
      .from(gymSettings)
      .where(eq(gymSettings.id, 1)),
  );
  return data[0]?.effortScale ?? DEFAULT_EFFORT_SCALE;
}

export function setEffortScale(effortScale: EffortScale): void {
  db.insert(gymSettings)
    .values({ id: 1, effortScale })
    .onConflictDoUpdate({ target: gymSettings.id, set: { effortScale } })
    .run();
}

/** Live per-muscle volume landmarks keyed by `muscle_group`; empty until the seed runs. */
export function useMuscleLandmarks(): Map<string, MuscleLandmarkBands> {
  const { data } = useLiveQuery(db.select().from(muscleLandmarks));
  return useMemo(
    () =>
      new Map(
        data.map((r) => [
          r.muscleGroup,
          { mv: r.mv, mev: r.mev, mav: r.mav, mrv: r.mrv },
        ]),
      ),
    [data],
  );
}

/** Persist one muscle's edited bands (upsert). Callers pass clamped bands. */
export function setMuscleLandmark(
  muscleGroup: string,
  bands: MuscleLandmarkBands,
): void {
  db.insert(muscleLandmarks)
    .values({ muscleGroup, ...bands })
    .onConflictDoUpdate({
      target: muscleLandmarks.muscleGroup,
      set: { mv: bands.mv, mev: bands.mev, mav: bands.mav, mrv: bands.mrv },
    })
    .run();
}

/** Restore every muscle's bands to the RP-derived defaults (upsert). */
export function resetMuscleLandmarks(): void {
  db.transaction((tx) => {
    for (const [muscleGroup, b] of Object.entries(DEFAULT_MUSCLE_LANDMARKS)) {
      tx.insert(muscleLandmarks)
        .values({ muscleGroup, mv: b.mv, mev: b.mev, mav: b.mav, mrv: b.mrv })
        .onConflictDoUpdate({
          target: muscleLandmarks.muscleGroup,
          set: { mv: b.mv, mev: b.mev, mav: b.mav, mrv: b.mrv },
        })
        .run();
    }
  });
}
