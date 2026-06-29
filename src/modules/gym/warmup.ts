// Warm-up calculator — ramp sets leading into a working weight. Following
// Liftosaur's model, the percentages are relative to the FIRST WORKING SET's
// weight (not 1RM). Pure and unit-tested; the active workout inserts the result
// as `setType: 'warmup'` rows so they're excluded from volume/PRs. Weights are in
// canonical kg; the caller supplies the bar and a rounding step.

import { roundKg } from './progression-engine';

export interface WarmupRung {
  /** Fraction of the working weight (1.0 = the work set itself, not emitted). */
  pct: number;
  reps: number;
}

/** Industry-standard ramp: empty bar, then 40/60/80% of the work weight. */
export const DEFAULT_WARMUP: readonly WarmupRung[] = [
  { pct: 0, reps: 8 }, // empty bar
  { pct: 0.4, reps: 5 },
  { pct: 0.6, reps: 3 },
  { pct: 0.8, reps: 2 },
];

export interface WarmupSet {
  reps: number;
  weightKg: number;
}

/**
 * Warm-up sets ramping to `workWeightKg`. A rung at 0% loads the bare bar; each
 * rung is rounded to a loadable weight and clamped to at least the bar. Rungs
 * that round to the full working weight (or beyond) are dropped — you don't
 * "warm up" at your work weight. Returns [] for bodyweight/very light work.
 */
export function warmupSets(
  workWeightKg: number,
  barKg: number,
  scheme: readonly WarmupRung[] = DEFAULT_WARMUP,
  stepKg = 2.5,
): WarmupSet[] {
  if (workWeightKg <= barKg) return [];
  const out: WarmupSet[] = [];
  for (const rung of scheme) {
    const raw =
      rung.pct === 0 ? barKg : roundKg(workWeightKg * rung.pct, stepKg);
    const weightKg = Math.max(barKg, raw);
    if (weightKg >= workWeightKg) continue; // never warm up at/over the work set
    out.push({ reps: rung.reps, weightKg });
  }
  return out;
}
