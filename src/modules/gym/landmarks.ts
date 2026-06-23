// Per-muscle weekly volume landmarks (MV ≤ MEV ≤ MAV ≤ MRV, in working sets per
// week) and zone classification — Renaissance Periodization's framework. See
// research.txt Part 2 §A1. DB/native-free so it unit-tests directly; the
// `useMuscleLandmarks` hook feeds live (editable) rows into `classifyVolume`.

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
 * Coarse-group defaults keyed by `exercises.muscle_group`. Weekly-set heuristics
 * meant as editable starting points, not law — `seedMuscleLandmarks` upserts
 * these so tuning them later still reaches already-seeded devices.
 *
 * `Chest` maps 1:1 to RP's muscle and uses their VERIFIED landmark row
 * (MV 2–4 / MEV 4–6 / MAV 6–16 / MRV 16–24, taken at each range's top). The
 * other five are SYNTHESIZED AGGREGATES: RP publishes landmarks per FINE muscle
 * (quads/hams/glutes; biceps/triceps; the three delt heads) and we collapse them
 * onto our coarse groups — these approximate, RP did not publish group numbers.
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
 * MV ≤ MEV ≤ MAV ≤ MRV that `classifyVolume` relies on: higher bands are raised
 * to at least the new value, lower bands are lowered to at most it. Pure — used
 * by the landmark editor so a user can't cross the bands. Returns new bands.
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
 * Place a muscle's weekly set count into its volume zone. Pure — pass the bands
 * in. Boundaries are inclusive at the lower landmark: exactly MEV is already
 * 'productive', exactly MRV is still 'maximal' (only above MRV is overreaching).
 *
 * NOTE: callers currently pass ALL completed sets, warmups included — the schema
 * has no set-type column yet (see research.txt Part 1 #3). Until set typing
 * lands this nudges muscles a zone high, so treat the bands as indicative.
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
