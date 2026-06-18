import { estimateOneRepMax } from './progression';

/**
 * How a logged set stacks up against the same set from the previous session.
 * Drives the active-workout beat-it cue (▲ improved / ▼ down / — even).
 */
export type SetComparison = 'up' | 'same' | 'down';

export interface ComparableSet {
  reps: number;
  /** Canonical kg — comparison happens in storage units (M1 discipline). */
  weightKg: number;
}

// Epley is deterministic, so identical inputs compare exactly equal; the epsilon
// only absorbs float noise between different-but-equivalent set shapes.
const EPSILON = 1e-9;

/**
 * Compare a set against its previous-session counterpart by estimated 1RM
 * (Epley) — the same metric M3's PR view uses, so heavier-fewer vs lighter-more
 * (82.5×3 vs 80×5) ranks consistently. Pure; unit-tested without a DB harness.
 */
export function compareToPrevious(
  current: ComparableSet,
  previous: ComparableSet,
): SetComparison {
  const delta =
    estimateOneRepMax(current.weightKg, current.reps) -
    estimateOneRepMax(previous.weightKg, previous.reps);
  if (delta > EPSILON) return 'up';
  if (delta < -EPSILON) return 'down';
  return 'same';
}
