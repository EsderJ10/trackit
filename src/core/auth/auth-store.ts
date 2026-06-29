import { create } from 'zustand';

import { authBackend } from './backend';

interface AuthState {
  /** True once the initial lock status has been read. */
  initialized: boolean;
  /** Whether an app lock is configured. */
  lockEnabled: boolean;
  /** Whether the app is currently locked (only meaningful when enabled). */
  locked: boolean;
  init: () => Promise<void>;
  refreshLockEnabled: () => Promise<void>;
  unlock: () => void;
  lock: () => void;
}

/**
 * Ephemeral auth/session state. Lives in Zustand (not the DB) because it is
 * runtime-only — the durable credential lives in SecureStore via `authBackend`.
 */
export const useAuthStore = create<AuthState>((set) => ({
  initialized: false,
  lockEnabled: false,
  locked: false,
  init: async () => {
    try {
      const lockEnabled = await authBackend.isLockEnabled();
      set({ initialized: true, lockEnabled, locked: lockEnabled });
    } catch (err) {
      // Degrade to "no lock" rather than hang the bootstrap gate on a
      // SecureStore read failure (`initialized` must always reach true).
      console.error('[auth-store] init failed', err);
      set({ initialized: true, lockEnabled: false, locked: false });
    }
  },
  refreshLockEnabled: async () => {
    const lockEnabled = await authBackend.isLockEnabled();
    set((state) => ({
      lockEnabled,
      locked: lockEnabled ? state.locked : false,
    }));
  },
  unlock: () => set({ locked: false }),
  lock: () => set((state) => (state.lockEnabled ? { locked: true } : {})),
}));
