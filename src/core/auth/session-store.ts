import { create } from 'zustand';

import { accountBackend } from './account-backend';
import type { User } from './types';

interface SessionState {
  /** True once the initial session has been resolved (read from SecureStore). */
  initialized: boolean;
  /** Whether an account exists on this device at all (drives login vs register). */
  hasAccount: boolean;
  /** The signed-in user, or null when logged out. */
  user: User | null;
  /** Resolve the persisted session on startup so the app reopens logged-in. */
  init: () => Promise<void>;
  /** Adopt a freshly authenticated user (after register/login). */
  setUser: (user: User) => void;
  /** End the session and return to the logged-out state. */
  logout: () => Promise<void>;
}

/**
 * Identity/session state. Lives in Zustand (not the DB) because it is
 * runtime-only — the durable account profile is in SQLite and the credential is
 * in SecureStore via `accountBackend`. Kept separate from the lock `auth-store`:
 * identity (who you are) and the device lock (fast re-unlock) are two seams.
 */
export const useSessionStore = create<SessionState>((set) => ({
  initialized: false,
  hasAccount: false,
  user: null,
  init: async () => {
    const [hasAccount, user] = await Promise.all([
      accountBackend.hasAccount(),
      accountBackend.getUser(),
    ]);
    set({ initialized: true, hasAccount, user });
  },
  setUser: (user) => set({ user, hasAccount: true }),
  logout: async () => {
    await accountBackend.logout();
    set({ user: null });
  },
}));
