/**
 * Personal-record math. Operates entirely on **canonical kg** (the storage
 * unit) — callers convert to the display unit at render with `formatWeight`,
 * keeping the M1 unit discipline. Pure and dependency-free, so it is unit-tested
 * without a native/DB harness (see `progression.test.ts`).
 */

export interface PrSet {
  reps: number;
  weight: number;
}

/**
 * Estimated one-rep max via the Epley formula: `w · (1 + reps/30)`. A single
 * rep is its own 1RM; non-positive reps fall back to the bare weight.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface ExercisePRs {
  /** Heaviest single set, in kg. */
  heaviestKg: number;
  /** Best estimated 1RM across all sets, in kg. */
  best1RmKg: number;
}

/** Personal records across every completed set; null when there is no history. */
export function computePRs(sets: PrSet[]): ExercisePRs | null {
  if (sets.length === 0) return null;
  let heaviestKg = 0;
  let best1RmKg = 0;
  for (const set of sets) {
    if (set.weight > heaviestKg) heaviestKg = set.weight;
    const estimate = estimateOneRepMax(set.weight, set.reps);
    if (estimate > best1RmKg) best1RmKg = estimate;
  }
  return { heaviestKg, best1RmKg };
}
