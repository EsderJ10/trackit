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
 * The between-sets rest timer. Lives in Zustand — the countdown is ephemeral,
 * runtime-only UI state. Storing an absolute `endsAt` (rather than a decrementing
 * counter) means it survives re-renders and background/foreground transitions.
 *
 * Two durable side effects hang off the timer's lifecycle and are coordinated
 * here so there is one owner: a scheduled LOCAL notification (the "rest over"
 * alert that fires even when the app is backgrounded — see `rest-notifications`)
 * and the persisted default length (the ±30s controls "stick" — see
 * `setDefaultRestSec`). `endsAt` is always set synchronously so the bar appears
 * instantly; the async schedule patches `notificationId` when it resolves.
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
      // A skip/restart may have landed before this resolved — only keep the id
      // if it still belongs to this rest, else cancel the now-orphaned alert.
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
    // Always cancel: an early skip suppresses the alert before it fires; a
    // natural completion only reaches here at-or-after `endsAt`, by when the OS
    // has already delivered, so the cancel is a harmless no-op.
    void cancelRestEnd(get().notificationId);
    set({ endsAt: null, notificationId: null });
  },
}));
