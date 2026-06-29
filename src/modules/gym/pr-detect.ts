// Personal-record detection when a set is completed — the live PR celebration.
// Fed the just-logged set + the exercise's all-time bests (excluding this session).

import { gatedOneRepMax } from './progression';
import type { MeasurementKind } from './queries';

// Single-number all-time bests; "most reps at a weight" (weight-keyed) deferred.
export type PRKind = '1rm' | 'weight' | 'volume' | 'duration';

/** A just-completed set, in canonical units. */
export interface PrCandidate {
  reps: number;
  weightKg: number;
  durationSec: number | null;
  measurementKind: MeasurementKind;
}

/** An exercise's all-time bests (each 0 when there is no prior history). */
export interface ExerciseBests {
  /** Best estimated 1RM (kg), gated to the reliable rep range. */
  best1RmKg: number;
  /** Heaviest single working set (kg). */
  bestWeightKg: number;
  /** Best single-set volume (weight × reps, kg). */
  bestVolumeKg: number;
  /** Longest timed set (seconds). */
  bestDurationSec: number;
}

export const EMPTY_BESTS: ExerciseBests = {
  best1RmKg: 0,
  bestWeightKg: 0,
  bestVolumeKg: 0,
  bestDurationSec: 0,
};

/**
 * Which records the candidate set beats. Load×reps lifts set weight/1RM/volume;
 * timed work sets duration. Equality ties (doesn't beat), so re-logging won't re-fire.
 */
export function detectPRs(set: PrCandidate, bests: ExerciseBests): PRKind[] {
  const kinds: PRKind[] = [];

  if (set.measurementKind === 'weight_reps') {
    const e1rm = gatedOneRepMax(set.weightKg, set.reps);
    if (e1rm !== null && e1rm > bests.best1RmKg && bests.best1RmKg > 0) {
      kinds.push('1rm');
    }
    if (set.weightKg > bests.bestWeightKg && bests.bestWeightKg > 0) {
      kinds.push('weight');
    }
    const volume = set.weightKg * set.reps;
    if (volume > bests.bestVolumeKg && bests.bestVolumeKg > 0) {
      kinds.push('volume');
    }
  }

  if (set.measurementKind === 'duration' && set.durationSec != null) {
    if (set.durationSec > bests.bestDurationSec && bests.bestDurationSec > 0) {
      kinds.push('duration');
    }
  }

  return kinds;
}

/** Fold a new set into the running bests so the same PR can't fire twice. */
export function foldBests(
  bests: ExerciseBests,
  set: PrCandidate,
): ExerciseBests {
  const e1rm =
    set.measurementKind === 'weight_reps'
      ? (gatedOneRepMax(set.weightKg, set.reps) ?? 0)
      : 0;
  const volume =
    set.measurementKind === 'weight_reps' ? set.weightKg * set.reps : 0;
  return {
    best1RmKg: Math.max(bests.best1RmKg, e1rm),
    bestWeightKg:
      set.measurementKind === 'weight_reps'
        ? Math.max(bests.bestWeightKg, set.weightKg)
        : bests.bestWeightKg,
    bestVolumeKg: Math.max(bests.bestVolumeKg, volume),
    bestDurationSec:
      set.measurementKind === 'duration' && set.durationSec != null
        ? Math.max(bests.bestDurationSec, set.durationSec)
        : bests.bestDurationSec,
  };
}

const PR_LABEL: Record<PRKind, string> = {
  '1rm': 'Estimated 1RM',
  weight: 'Heaviest set',
  volume: 'Best set volume',
  duration: 'Longest hold',
};

/** Human label for a banner, e.g. "Bench Press · Heaviest set". */
export function prMessage(exerciseName: string, kinds: PRKind[]): string {
  const best = kinds[0];
  if (best == null) return exerciseName;
  return `${exerciseName} · ${PR_LABEL[best]}`;
}
