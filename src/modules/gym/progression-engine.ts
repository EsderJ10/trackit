/**
 * Progression engine — turns a per-exercise progression *scheme* plus its
 * persisted *state* into the next session's suggested sets, and advances that
 * state once a session is logged.
 *
 * Pure and dependency-free (like `progression.ts`), so it is unit-tested without
 * a native/DB harness. All weights are **canonical kg** — the M1 unit discipline
 * — and callers convert to the display unit at render with `formatWeight`.
 *
 * Phase 1 ships the two deterministic schemes that need no extra captured data:
 *   - **Linear progression (lp)** — fixed weight jump on success; deload after
 *     N consecutive failed sessions.
 *   - **Double progression (dp)** — climb reps within a range, then add weight
 *     and reset to the bottom of the range.
 * Percentage/training-max and RPE schemes land in later M5 phases (they need a
 * stored training max and an RPE→%1RM table).
 */

// ---------------------------------------------------------------------------
// Schemes (the rule) and state (what carries between sessions)
// ---------------------------------------------------------------------------

export interface LpScheme {
  type: 'lp';
  /** Weight added (kg) after a successful session. */
  incrementKg: number;
  /** Consecutive failed sessions before a deload. */
  failThreshold: number;
  /** Fractional deload, e.g. 0.1 drops the weight 10%. */
  deloadPct: number;
}

export interface DpScheme {
  type: 'dp';
  /** Weight added (kg) once the top of the rep range is cleared on every set. */
  incrementKg: number;
  /** Bottom of the working rep range (reset point after a weight jump). */
  minReps: number;
  /** Top of the working rep range (clear it on all sets to add weight). */
  maxReps: number;
}

export type ProgressionScheme = LpScheme | DpScheme;

/** The mutable state a scheme carries forward, persisted per program-exercise. */
export interface ProgressionState {
  /** Working weight (kg) for the next session. */
  currentWeightKg: number;
  /** Target reps per set for the next session (moves within range for dp). */
  currentReps: number;
  /** Consecutive successful sessions. */
  successStreak: number;
  /** Consecutive failed sessions. */
  failStreak: number;
}

/** One suggested set for the next session. */
export interface SuggestedSet {
  reps: number;
  weightKg: number;
}

/** The result of advancing state after a logged session. */
export interface AdvanceResult {
  state: ProgressionState;
  /** Human-readable explanation of the change, surfaced in the UI. */
  reason: string;
}

/** A completed set, as fed back in to advance the scheme. */
export interface LoggedSet {
  reps: number;
  weightKg: number;
}

// ---------------------------------------------------------------------------
// Cursor — where the lifter is in the program's week × day grid
// ---------------------------------------------------------------------------

/** The program's position: which week (1-based), which day (0-based), cycle. */
export interface ProgramCursor {
  currentWeek: number;
  currentDayIndex: number;
  currentCycle: number;
}

/**
 * Advance the cursor one day. Days rotate within a week; past the last day the
 * week advances; past the last week the cycle advances and we wrap to week 1,
 * day 0 (a new pass through the whole program — where percentage schemes bump
 * their training max). `dayCount`/`weekCount` are the program's totals (>= 1).
 */
export function advanceCursor(
  cursor: ProgramCursor,
  dayCount: number,
  weekCount: number,
): ProgramCursor {
  const days = Math.max(1, dayCount);
  const weeks = Math.max(1, weekCount);
  let { currentWeek, currentDayIndex, currentCycle } = cursor;

  currentDayIndex += 1;
  if (currentDayIndex >= days) {
    currentDayIndex = 0;
    currentWeek += 1;
    if (currentWeek > weeks) {
      currentWeek = 1;
      currentCycle += 1;
    }
  }
  return { currentWeek, currentDayIndex, currentCycle };
}

// ---------------------------------------------------------------------------
// Rounding — suggestions must land on a loadable weight, never 62.5237 kg
// ---------------------------------------------------------------------------

/** Round a weight to the nearest achievable step (defaults to 2.5 kg). */
export function roundKg(weightKg: number, stepKg = 2.5): number {
  if (stepKg <= 0) return weightKg;
  return Math.round(weightKg / stepKg) * stepKg;
}

// ---------------------------------------------------------------------------
// RPE → %1RM — the autoregulated intensity (RTS chart, non-linear)
// ---------------------------------------------------------------------------

/**
 * The canonical Reactive Training Systems (Tuchscherer) RPE→%1RM curve, encoded
 * as its single underlying dimension: the **@RPE-10 column** — load (as a
 * fraction of 1RM) you can lift for `n` reps *to failure*. The full chart is
 * recovered by the RIR-shift identity (RPE 9 ≡ 1 RIR): a set of `reps` @ `rpe`
 * is `reps + (10 − rpe)` reps from failure, so it loads like that many reps @10.
 *
 * Keys are `reps-to-failure × 2` (0.5-rep resolution, which is what 0.5-RPE
 * steps demand); values are %1RM as a decimal. Transcribed from the published
 * RTS chart — NOT the old Epley-inverse formula, which is non-linear-mismatched
 * and was soft at the 1RM anchor (the `rpePct(10,1)=0.968` under-load bug). The
 * `[2] = 1.0` entry fixes that by construction. See research.txt Part 2 §A2.
 */
const RPE10_PCT: Readonly<Record<number, number>> = {
  2: 1.0, // 1.0 reps to failure  → 1RM
  3: 0.978, // 1.5
  4: 0.955, // 2.0
  5: 0.939, // 2.5
  6: 0.922, // 3.0
  7: 0.907, // 3.5
  8: 0.892, // 4.0
  9: 0.878, // 4.5
  10: 0.863, // 5.0
  11: 0.85, // 5.5
  12: 0.837, // 6.0
  13: 0.824, // 6.5
  14: 0.811, // 7.0
  15: 0.799, // 7.5
  16: 0.786, // 8.0
  17: 0.774, // 8.5
  18: 0.762, // 9.0
  19: 0.751, // 9.5
  20: 0.739, // 10.0
  21: 0.723, // 10.5
  22: 0.707, // 11.0
  23: 0.694, // 11.5
  24: 0.68, // 12.0
};

const RPE10_MIN_KEY = 2;
const RPE10_MAX_KEY = 24;

/**
 * Load fraction for `n` reps to failure, interpolating the @10 curve at half-rep
 * resolution and extrapolating past 12 reps along the final slope (clamped to a
 * sane floor). Pure; the single source of truth shared by `rpePct` and its
 * inverse `e1rmFromLoggedSet`, so the two can never drift apart.
 */
function repsToFailurePct(n: number): number {
  const key = Math.round(Math.max(1, n) * 2);
  if (key <= RPE10_MIN_KEY) return RPE10_PCT[RPE10_MIN_KEY] as number;
  if (key <= RPE10_MAX_KEY) {
    const exact = RPE10_PCT[key];
    if (exact !== undefined) return exact;
    // Half-key landed off-grid (non-0.5 RPE input): linear-interpolate neighbours.
    const lo = RPE10_PCT[key - 1] as number;
    const hi = RPE10_PCT[key + 1] as number;
    return (lo + hi) / 2;
  }
  // Past the table — continue along the last segment's slope, floored at 5%.
  const last = RPE10_PCT[RPE10_MAX_KEY] as number;
  const prev = RPE10_PCT[RPE10_MAX_KEY - 1] as number;
  return Math.max(0.05, last + (last - prev) * (key - RPE10_MAX_KEY));
}

/**
 * Fraction of estimated 1RM a set of `reps` taken to `rpe` represents. RPE is on
 * the RIR scale (RIR = 10 − RPE), so a set of `reps` @ `rpe` is `reps + RIR`
 * reps from true failure (the RTS chart's structure). Clamped to (0, 1]; RPE
 * above 10 or below 1 is treated as the nearest bound. `rpePct(10, 1) === 1`.
 */
export function rpePct(rpe: number, reps: number): number {
  const clampedRpe = Math.min(10, Math.max(1, rpe));
  const repsToFailure = Math.max(1, reps + (10 - clampedRpe));
  return repsToFailurePct(repsToFailure);
}

/**
 * Estimated 1RM (kg) implied by a logged set of `reps` at `weightKg` taken to
 * `rpe`. This is the exact inverse of the rpe render path (`weight = e1rm ·
 * rpePct`), so re-anchoring from a set that *hit its prescription* leaves the
 * anchor flat — beating it (more reps / higher RPE at the same load) raises it,
 * missing it lowers it. (Using a to-failure 1RM estimate here instead would make
 * a hit-the-target session spiral the anchor — and the load — downward.)
 */
export function e1rmFromLoggedSet(
  weightKg: number,
  reps: number,
  rpe: number,
): number {
  return weightKg / rpePct(rpe, reps);
}

// ---------------------------------------------------------------------------
// Prescription rendering — one program_set row → a concrete suggested set
// ---------------------------------------------------------------------------

/** A per-set prescription (one `program_sets` row), independent of scheme. */
export interface Prescription {
  reps: number;
  /** `abs` = literal kg, `pct` = fraction of training max, `rpe` = target RPE. */
  intensityKind: 'abs' | 'pct' | 'rpe';
  intensityValue: number;
  amrap: boolean;
}

/** The mutable numbers a prescription is rendered against. */
export interface RenderContext {
  /** Working weight (kg) — the `abs` fallback when no literal load is given. */
  currentWeightKg: number;
  /** Training max (kg) for `pct` prescriptions. */
  trainingMaxKg: number | null;
  /** Estimated 1RM (kg) for `rpe` prescriptions. */
  e1rmKg: number | null;
  /** Loadable rounding step (kg). */
  stepKg: number;
}

/** A rendered set: a concrete load + reps, plus whether it's an AMRAP top set. */
export interface RenderedSet {
  reps: number;
  weightKg: number;
  amrap: boolean;
}

/** Turn one prescription into a concrete suggested set against the context. */
export function renderPrescribedSet(
  p: Prescription,
  ctx: RenderContext,
): RenderedSet {
  if (p.intensityKind === 'pct') {
    const tm = ctx.trainingMaxKg ?? 0;
    return {
      reps: p.reps,
      weightKg: roundKg(tm * p.intensityValue, ctx.stepKg),
      amrap: p.amrap,
    };
  }
  if (p.intensityKind === 'rpe') {
    const e1rm = ctx.e1rmKg ?? 0;
    return {
      reps: p.reps,
      weightKg: roundKg(e1rm * rpePct(p.intensityValue, p.reps), ctx.stepKg),
      amrap: p.amrap,
    };
  }
  // `abs`: a literal kg load, falling back to the working weight when unset (0).
  return {
    reps: p.reps,
    weightKg: p.intensityValue || ctx.currentWeightKg,
    amrap: p.amrap,
  };
}

// ---------------------------------------------------------------------------
// Suggest — render the next session's sets from the current state
// ---------------------------------------------------------------------------

/**
 * The sets to pre-fill for the next session: `targetSets` identical sets at the
 * scheme's current weight and rep target. Suggestion is advisory — the user
 * accepts or overrides each set.
 */
export function suggestNext(
  state: ProgressionState,
  targetSets: number,
): SuggestedSet[] {
  const sets = Math.max(1, targetSets);
  return Array.from({ length: sets }, () => ({
    reps: state.currentReps,
    weightKg: state.currentWeightKg,
  }));
}

// ---------------------------------------------------------------------------
// Advance — fold a logged session into the next state
// ---------------------------------------------------------------------------

/**
 * A session *succeeds* when at least `targetSets` sets were completed and every
 * one of them met the rep target at (or above) the working weight. Anything
 * short — fewer sets, missed reps — is a failure.
 */
function hitTargets(
  logged: LoggedSet[],
  targetSets: number,
  targetReps: number,
  weightKg: number,
): boolean {
  const working = logged.filter((s) => s.weightKg >= weightKg);
  if (working.length < targetSets) return false;
  return working.slice(0, targetSets).every((s) => s.reps >= targetReps);
}

export function advance(
  scheme: ProgressionScheme,
  state: ProgressionState,
  logged: LoggedSet[],
  targetSets: number,
): AdvanceResult {
  return scheme.type === 'lp'
    ? advanceLp(scheme, state, logged, targetSets)
    : advanceDp(scheme, state, logged, targetSets);
}

function advanceLp(
  scheme: LpScheme,
  state: ProgressionState,
  logged: LoggedSet[],
  targetSets: number,
): AdvanceResult {
  const success = hitTargets(
    logged,
    targetSets,
    state.currentReps,
    state.currentWeightKg,
  );

  if (success) {
    // start + n×increment is loadable by construction — only the deload path
    // (×0.9) yields a fractional weight that needs rounding.
    const next = state.currentWeightKg + scheme.incrementKg;
    return {
      state: {
        ...state,
        currentWeightKg: next,
        successStreak: state.successStreak + 1,
        failStreak: 0,
      },
      reason: `+${scheme.incrementKg} kg — hit all reps`,
    };
  }

  const failStreak = state.failStreak + 1;
  if (failStreak >= scheme.failThreshold) {
    const next = roundKg(state.currentWeightKg * (1 - scheme.deloadPct));
    return {
      state: {
        ...state,
        currentWeightKg: next,
        successStreak: 0,
        failStreak: 0,
      },
      reason: `−${Math.round(scheme.deloadPct * 100)}% — missed ${scheme.failThreshold} sessions`,
    };
  }

  return {
    state: { ...state, successStreak: 0, failStreak },
    reason: 'Repeat — missed reps last time',
  };
}

function advanceDp(
  scheme: DpScheme,
  state: ProgressionState,
  logged: LoggedSet[],
  targetSets: number,
): AdvanceResult {
  // Cleared the top of the range on every set → add weight, reset to the bottom.
  if (hitTargets(logged, targetSets, scheme.maxReps, state.currentWeightKg)) {
    // start + n×increment is loadable by construction — only the deload path
    // (×0.9) yields a fractional weight that needs rounding.
    const next = state.currentWeightKg + scheme.incrementKg;
    return {
      state: {
        ...state,
        currentWeightKg: next,
        currentReps: scheme.minReps,
        successStreak: state.successStreak + 1,
        failStreak: 0,
      },
      reason: `+${scheme.incrementKg} kg — cleared ${scheme.maxReps} reps`,
    };
  }

  // Hit the current target but not yet the top → climb one rep, same weight.
  if (
    hitTargets(logged, targetSets, state.currentReps, state.currentWeightKg) &&
    state.currentReps < scheme.maxReps
  ) {
    const reps = state.currentReps + 1;
    return {
      state: { ...state, currentReps: reps, successStreak: 0, failStreak: 0 },
      reason: `+1 rep — aim for ${reps} this time`,
    };
  }

  // Missed the target → repeat the same prescription.
  return {
    state: { ...state, successStreak: 0, failStreak: state.failStreak + 1 },
    reason: 'Repeat — missed reps last time',
  };
}

// ---------------------------------------------------------------------------
// Slot advance — fold one program-exercise's logged session into its state
// ---------------------------------------------------------------------------

/**
 * The progression rule for one program-exercise slot, as the DB row carries it.
 * `percent` schemes don't fold per session (their training max bumps on the
 * cycle wrap), so they never reach `advanceSlot`.
 */
export interface SlotProgressionConfig {
  schemeType: 'lp' | 'dp' | 'rpe';
  incrementKg: number;
  minReps: number | null;
  maxReps: number | null;
  failThreshold: number;
  deloadPct: number;
  targetSets: number;
  /** Target RPE for the autoregulated scheme (defaults to 8 when unset). */
  targetRpe: number | null;
}

/** A completed working set, with the RPE it was logged at (null = pre-filled). */
export interface LoggedWorkingSet {
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number | null;
}

/**
 * The state mutation a folded session implies. `rpe` schemes re-anchor the
 * estimated 1RM; `lp`/`dp` schemes advance the working-weight progression state.
 * The DB wrapper (`advanceProgram`) maps the variant onto the right columns.
 */
export type SlotAdvance =
  | { kind: 'e1rm'; e1rmKg: number; reason: string }
  | { kind: 'state'; state: ProgressionState; reason: string };

/**
 * Fold one slot's completed working sets into its next state — the pure decision
 * behind `advanceProgram`, lifted out of the data layer so it is unit-testable.
 * Callers pass only slots with at least one logged working set.
 *
 * For `rpe`, re-anchor the estimated 1RM from the best logged set via the exact
 * inverse of the render path, so a hit-the-prescription session holds the anchor
 * flat. Pre-filled sets log no RPE, so each set re-anchors against the RPE it was
 * *rendered* at (`prescribedRpeBySet`), falling back to the slot's target — using
 * the target on a week whose prescribed RPE differs would drift the anchor.
 */
export function advanceSlot(
  config: SlotProgressionConfig,
  state: ProgressionState,
  logged: LoggedWorkingSet[],
  prescribedRpeBySet: ReadonlyMap<number, number>,
): SlotAdvance {
  if (config.schemeType === 'rpe') {
    const targetRpe = config.targetRpe ?? 8;
    const best = Math.max(
      ...logged.map((s) =>
        e1rmFromLoggedSet(
          s.weightKg,
          s.reps,
          s.rpe ?? prescribedRpeBySet.get(s.setNumber) ?? targetRpe,
        ),
      ),
    );
    return {
      kind: 'e1rm',
      e1rmKg: best,
      reason: `Est. 1RM ${Math.round(best)} kg — autoregulated`,
    };
  }

  const scheme: ProgressionScheme =
    config.schemeType === 'dp'
      ? {
          type: 'dp',
          incrementKg: config.incrementKg,
          minReps: config.minReps ?? 1,
          maxReps: config.maxReps ?? config.minReps ?? 1,
        }
      : {
          type: 'lp',
          incrementKg: config.incrementKg,
          failThreshold: config.failThreshold,
          deloadPct: config.deloadPct,
        };

  const { state: next, reason } = advance(
    scheme,
    state,
    logged.map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
    config.targetSets,
  );
  return { kind: 'state', state: next, reason };
}

// ---------------------------------------------------------------------------
// Mesocycle wave — generate a periodized week × set prescription grid
// ---------------------------------------------------------------------------

/**
 * The two-axis mesocycle the evidence wants (RP, verified 3-0): across the
 * accumulation weeks **RIR descends** (effort climbs week to week) while the
 * **working-set count ramps from MEV up toward MRV**; an optional lighter deload
 * week is appended to dissipate fatigue. Authored once per program-exercise and
 * rendered per session. See research.txt Part 2 §A3 and 5day-ulppl spec.
 */
export interface WaveRules {
  /** Accumulation (hard) weeks, before any deload. ≥ 1. */
  weekCount: number;
  /** Working sets in week 1 (≈ MEV). */
  setsStart: number;
  /** Working sets in the last hard week (≈ MRV). */
  setsEnd: number;
  /** Working reps per set (held roughly constant across the meso). */
  reps: number;
  /** Reps-in-reserve in week 1 (e.g. 3 → RPE 7). */
  rirStart: number;
  /** Reps-in-reserve in the last hard week (e.g. 0 → RPE 10, or 1 for risky lifts). */
  rirEnd: number;
  /** Mark the top set of every week AMRAP (the "1+" top set). */
  amrapLastSet: boolean;
  /** Optional appended deload week (lighter, fewer sets). */
  deload?: { sets: number; reps: number; rir: number };
}

/** One generated prescription cell — a `program_sets` row, pre-DB. */
export interface WaveSet {
  /** 1-based week. */
  weekIndex: number;
  /** 1-based set within the week. */
  setNumber: number;
  reps: number;
  /** Always `rpe`: the descending-RIR wave encodes intensity as target RPE. */
  intensityKind: 'rpe';
  /** Target RPE = 10 − RIR, clamped to [1, 10]. */
  intensityValue: number;
  amrap: boolean;
}

/** Linear interpolate `a→b` at fraction `t` (t already in [0, 1]). */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Expand `WaveRules` into one `WaveSet` per (week, set). Pure — the DB wrapper
 * `generateProgramWave` turns these into `program_sets` rows. The deload week, if
 * present, is appended as `weekCount + 1`.
 */
export function generateWave(rules: WaveRules): WaveSet[] {
  const weeks = Math.max(1, Math.round(rules.weekCount));
  const out: WaveSet[] = [];
  const span = weeks > 1 ? weeks - 1 : 1;

  for (let w = 1; w <= weeks; w++) {
    const t = (w - 1) / span;
    const sets = Math.max(
      1,
      Math.round(lerp(rules.setsStart, rules.setsEnd, t)),
    );
    const rir = lerp(rules.rirStart, rules.rirEnd, t);
    const rpe = Math.min(10, Math.max(1, 10 - rir));
    for (let s = 1; s <= sets; s++) {
      out.push({
        weekIndex: w,
        setNumber: s,
        reps: rules.reps,
        intensityKind: 'rpe',
        intensityValue: Math.round(rpe * 2) / 2, // snap to 0.5-RPE steps
        amrap: rules.amrapLastSet && s === sets,
      });
    }
  }

  if (rules.deload) {
    const d = rules.deload;
    const sets = Math.max(1, Math.round(d.sets));
    const rpe = Math.min(10, Math.max(1, 10 - d.rir));
    for (let s = 1; s <= sets; s++) {
      out.push({
        weekIndex: weeks + 1,
        setNumber: s,
        reps: d.reps,
        intensityKind: 'rpe',
        intensityValue: Math.round(rpe * 2) / 2,
        amrap: false,
      });
    }
  }

  return out;
}
