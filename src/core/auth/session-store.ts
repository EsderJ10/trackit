import { create } from 'zustand';

import { accountBackend } from './account-backend';
import type { User } from './types';

interface SessionState {
  initialized: boolean;
  /** Whether an account exists on this device (drives login vs register). */
  hasAccount: boolean;
  user: User | null;
  init: () => Promise<void>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
}

// Runtime-only session state, separate from the lock `auth-store`: identity and
// the device lock are two distinct seams. Durable profile in SQLite, credential
// in SecureStore via `accountBackend`.
export const useSessionStore = create<SessionState>((set) => ({
  initialized: false,
  hasAccount: false,
  user: null,
  init: async () => {
    try {
      const [hasAccount, user] = await Promise.all([
        accountBackend.hasAccount(),
        accountBackend.getUser(),
      ]);
      set({ initialized: true, hasAccount, user });
    } catch (err) {
      // Never strand the splash gate (`initialized` drives it): fall back to
      // logged-out/no-account so the user can still reach register/login.
      console.error('[session-store] init failed', err);
      set({ initialized: true, hasAccount: false, user: null });
    }
  },
  setUser: (user) => set({ user, hasAccount: true }),
  logout: async () => {
    try {
      await accountBackend.logout();
    } catch (err) {
      // Clear local state regardless so a failed credential wipe can't strand
      // the user in the session.
      console.error('[session-store] logout failed', err);
    } finally {
      set({ user: null });
    }
  },
}));
