import { create } from 'zustand';

/** Default rest between sets, and the step for the ±30s controls. */
export const DEFAULT_REST_MS = 120_000;
export const REST_STEP_MS = 30_000;

interface RestTimerState {
  /** Default rest length; the ±30s controls adjust the running timer only. */
  durationMs: number;
  /** Absolute epoch-ms the current rest ends, or null when idle. */
  endsAt: number | null;
  /** Start (or restart) the rest countdown from the default duration. */
  start: () => void;
  /** Shift the running timer by `deltaMs`, never below the current moment. */
  adjust: (deltaMs: number) => void;
  /** Clear the timer (skip / dismiss). */
  stop: () => void;
}

/**
 * The between-sets rest timer. Lives in Zustand — it is ephemeral, runtime-only
 * UI state (the CLAUDE.md "active workout session" example), not durable data,
 * so it never touches the DB. Storing an absolute `endsAt` (rather than a
 * decrementing counter) means the countdown survives re-renders and
 * background/foreground transitions: the view derives remaining time from the
 * clock on each tick.
 */
export const useRestTimer = create<RestTimerState>((set, get) => ({
  durationMs: DEFAULT_REST_MS,
  endsAt: null,
  start: () => set({ endsAt: Date.now() + get().durationMs }),
  adjust: (deltaMs) => {
    const { endsAt } = get();
    if (endsAt == null) return;
    set({ endsAt: Math.max(Date.now(), endsAt + deltaMs) });
  },
  stop: () => set({ endsAt: null }),
}));
