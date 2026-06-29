// Personal-record math. Operates on canonical kg; callers convert at render.

export interface PrSet {
  reps: number;
  weight: number;
}

/** Reps above which a 1RM estimate is unreliable (Epley loses accuracy past ~12). See research.txt Part 2 §A4. */
export const E1RM_MAX_REPS = 12;

/** Epley 1RM: `w · (1 + reps/30)`. A single rep is its own 1RM; non-positive reps → bare weight. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/**
 * Estimated 1RM gated to the reliable rep range: `null` above `E1RM_MAX_REPS`,
 * so callers can render "—" instead of an inflated figure from a high-rep set.
 */
export function gatedOneRepMax(weightKg: number, reps: number): number | null {
  if (reps > E1RM_MAX_REPS) return null;
  return estimateOneRepMax(weightKg, reps);
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
    // High-rep sets give unreliable 1RM estimates — exclude them from the PR.
    const estimate = gatedOneRepMax(set.weight, set.reps);
    if (estimate !== null && estimate > best1RmKg) best1RmKg = estimate;
  }
  return { heaviestKg, best1RmKg };
}
