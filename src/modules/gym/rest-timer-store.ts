import { create } from 'zustand';

import { setDefaultRestSec } from './queries';
import { cancelRestEnd, scheduleRestEnd } from './rest-notifications';

/** Default rest between sets, the step for the ±30s controls, and the floor. */
export const DEFAULT_REST_MS = 120_000;
export const REST_STEP_MS = 30_000;
export const MIN_REST_MS = 30_000;

interface RestTimerState {
  /** Default rest length; the ±30s controls reshape this and the running timer. */
  durationMs: number;
  /** Absolute epoch-ms the current rest ends, or null when idle. */
  endsAt: number | null;
  /** Id of the scheduled "rest over" notification, so it can be cancelled. */
  notificationId: string | null;
  /** Replace the default length (e.g. hydrate from the persisted setting). */
  setDuration: (ms: number) => void;
  /** Start (or restart) the rest countdown from the default duration. */
  start: () => void;
  /** Shift the running timer by `deltaMs` and stick it as the new default. */
  adjust: (deltaMs: number) => void;
  /** Clear the timer (skip / dismiss) and cancel its pending notification. */
  stop: () => void;
}

/**
 * The between-sets rest timer (ephemeral Zustand state). An absolute `endsAt`
 * (not a decrementing counter) survives re-renders and background transitions.
 * Two durable side effects are coordinated here so there's one owner: the LOCAL
 * "rest over" notification and the persisted default length. `endsAt` is set
 * synchronously (bar appears instantly); the async schedule patches `notificationId`.
 */
export const useRestTimer = create<RestTimerState>((set, get) => ({
  durationMs: DEFAULT_REST_MS,
  endsAt: null,
  notificationId: null,

  setDuration: (ms) => set({ durationMs: Math.max(MIN_REST_MS, ms) }),

  start: () => {
    void cancelRestEnd(get().notificationId);
    const { durationMs } = get();
    const endsAt = Date.now() + durationMs;
    set({ endsAt, notificationId: null });
    void scheduleRestEnd(Math.round(durationMs / 1000)).then((id) => {
      // Keep the id only if this rest is still current, else cancel the orphan.
      if (get().endsAt === endsAt) set({ notificationId: id });
      else void cancelRestEnd(id);
    });
  },

  adjust: (deltaMs) => {
    const { endsAt, durationMs, notificationId } = get();
    if (endsAt == null) return;
    const nextEndsAt = Math.max(Date.now(), endsAt + deltaMs);
    const nextDuration = Math.max(MIN_REST_MS, durationMs + deltaMs);
    void cancelRestEnd(notificationId);
    set({ endsAt: nextEndsAt, durationMs: nextDuration, notificationId: null });
    // ± sticks as the new default, persisted for the next session.
    setDefaultRestSec(Math.round(nextDuration / 1000));
    const remainingSec = Math.round((nextEndsAt - Date.now()) / 1000);
    void scheduleRestEnd(remainingSec).then((id) => {
      if (get().endsAt === nextEndsAt) set({ notificationId: id });
      else void cancelRestEnd(id);
    });
  },

  stop: () => {
    // Always cancel: suppresses an early skip; a natural completion's alert has
    // already fired by `endsAt`, so the cancel is then a harmless no-op.
    void cancelRestEnd(get().notificationId);
    set({ endsAt: null, notificationId: null });
  },
}));
