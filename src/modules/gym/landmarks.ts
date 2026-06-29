// Per-muscle weekly volume landmarks (MV ≤ MEV ≤ MAV ≤ MRV, working sets/week)
// and zone classification — Renaissance Periodization's framework. See
// research.txt Part 2 §A1. `useMuscleLandmarks` feeds live editable rows in.

export interface MuscleLandmarkBands {
  /** Maintenance Volume — least that retains the muscle. */
  mv: number;
  /** Minimum Effective Volume — least that still drives growth. */
  mev: number;
  /** Maximum Adaptive Volume — top of the productive working range. */
  mav: number;
  /** Maximum Recoverable Volume — recovery ceiling; beyond it is overreaching. */
  mrv: number;
}

/**
 * Coarse-group defaults keyed by `exercises.muscle_group` — editable starting
 * points (`seedMuscleLandmarks` upserts, so later tuning still reaches devices).
 * `Chest` is RP's VERIFIED row; the other five are SYNTHESIZED AGGREGATES of RP's
 * per-fine-muscle numbers (RP published no coarse-group figures).
 * Source: https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth
 */
export const DEFAULT_MUSCLE_LANDMARKS: Readonly<
  Record<string, MuscleLandmarkBands>
> = {
  Chest: { mv: 4, mev: 6, mav: 16, mrv: 24 }, // verified RP row (range-tops)
  Back: { mv: 6, mev: 10, mav: 20, mrv: 25 }, // synthesized aggregate
  Legs: { mv: 6, mev: 8, mav: 18, mrv: 24 }, // synthesized: quads+hams+glutes
  Shoulders: { mv: 6, mev: 8, mav: 18, mrv: 26 }, // synthesized: 3 delt heads
  Arms: { mv: 4, mev: 8, mav: 18, mrv: 26 }, // synthesized: biceps+triceps
  Core: { mv: 0, mev: 6, mav: 16, mrv: 25 }, // synthesized: abs, indirectly worked
};

/** The four editable bands, in ascending order. */
export type LandmarkKey = 'mv' | 'mev' | 'mav' | 'mrv';

const LANDMARK_ORDER: readonly LandmarkKey[] = ['mv', 'mev', 'mav', 'mrv'];

/**
 * Set one band to `value` (floored at 0, rounded) and re-establish the invariant
 * MV ≤ MEV ≤ MAV ≤ MRV: higher bands raised to ≥ value, lower bands lowered to ≤ it.
 */
export function setBand(
  bands: MuscleLandmarkBands,
  key: LandmarkKey,
  value: number,
): MuscleLandmarkBands {
  const v = Math.max(0, Math.round(value));
  const out: MuscleLandmarkBands = { ...bands, [key]: v };
  const idx = LANDMARK_ORDER.indexOf(key);
  for (let i = idx + 1; i < LANDMARK_ORDER.length; i++) {
    const k = LANDMARK_ORDER[i];
    if (k && out[k] < v) out[k] = v;
  }
  for (let i = idx - 1; i >= 0; i--) {
    const k = LANDMARK_ORDER[i];
    if (k && out[k] > v) out[k] = v;
  }
  return out;
}

/** Where a muscle's weekly volume sits relative to its landmarks. */
export type VolumeZone =
  | 'below-mv'
  | 'maintenance'
  | 'productive'
  | 'maximal'
  | 'overreaching';

/** Short label per zone, for the UI legend. */
export const ZONE_LABEL: Readonly<Record<VolumeZone, string>> = {
  'below-mv': 'Under',
  maintenance: 'Maintaining',
  productive: 'Growing',
  maximal: 'Near max',
  overreaching: 'Over MRV',
};

/**
 * Place a muscle's weekly set count into its volume zone. Boundaries inclusive at
 * the lower landmark: exactly MEV is 'productive', exactly MRV still 'maximal'.
 * NOTE: callers pass ALL completed sets incl. warmups (no set-type filter), which
 * nudges muscles a zone high — treat bands as indicative. See research.txt Part 1 #3.
 */
export function classifyVolume(
  sets: number,
  lm: MuscleLandmarkBands,
): VolumeZone {
  if (sets < lm.mev) return sets >= lm.mv ? 'maintenance' : 'below-mv';
  if (sets < lm.mav) return 'productive';
  if (sets <= lm.mrv) return 'maximal';
  return 'overreaching';
}
