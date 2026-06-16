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
// RPE → %1RM — the autoregulated intensity (Epley-consistent)
// ---------------------------------------------------------------------------

/**
 * Fraction of estimated 1RM a set of `reps` taken to `rpe` represents. RPE is on
 * the RIR scale (RIR = 10 − RPE), so a set of `reps` @ `rpe` is `reps + RIR`
 * reps from true failure; inverting Epley (1RM = w·(1 + n/30)) gives the load.
 * Clamped to [0, 1]; RPE above 10 or below 1 is treated as the nearest bound.
 */
export function rpePct(rpe: number, reps: number): number {
  const clampedRpe = Math.min(10, Math.max(1, rpe));
  const repsToFailure = Math.max(1, reps + (10 - clampedRpe));
  return 1 / (1 + repsToFailure / 30);
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
