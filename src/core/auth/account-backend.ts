import { eq } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { db } from '@/core/db/client';

import { users, type UserRow } from './schema';
import {
  AccountError,
  type LoginInput,
  type RegisterInput,
  type User,
} from './types';

/**
 * The identity seam. v1 is a purely-local account: one username/email + password
 * account per device, hashed on-device. The core only ever talks to this
 * interface — a cloud provider (Supabase/Clerk) can be dropped in later by
 * implementing `AccountBackend` without touching the login UI or session store.
 *
 * This is the IDENTITY counterpart to `backend.ts`'s `AuthBackend`, which owns
 * the orthogonal device LOCK (PIN/biometric). Password establishes who you are;
 * the lock is a fast re-unlock for the already-logged-in user.
 */
export interface AccountBackend {
  /** Whether an account has been created on this device. */
  hasAccount(): Promise<boolean>;
  /** The signed-in user id, or null when logged out. Persists across restarts. */
  getSessionUserId(): Promise<string | null>;
  /** Create the device's account and start a session. */
  register(input: RegisterInput): Promise<User>;
  /** Verify credentials and start a session. */
  login(input: LoginInput): Promise<User>;
  /** End the session (keeps the account and all data). */
  logout(): Promise<void>;
  /** Replace the password after verifying the current one. */
  changePassword(input: { current: string; next: string }): Promise<void>;
  /** The signed-in user's profile, or null when logged out. */
  getUser(): Promise<User | null>;
}

const CREDENTIAL_KEY = 'trackit.account.v1';
const SESSION_KEY = 'trackit.session.v1';

/**
 * SHA-256 stretching rounds. expo-crypto exposes no PBKDF2/bcrypt, so we iterate
 * a salted digest (the PIN lock does a single round; a password is higher-value
 * so we stretch). Kept modest so register/login stay responsive on-device — real
 * KDF-grade hashing is a concern for the future cloud backend, not this local gate.
 */
const HASH_ROUNDS = 600;

interface StoredCredential {
  userId: string;
  salt: string;
  hash: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  let digest = `${salt}:${password}`;
  for (let i = 0; i < HASH_ROUNDS; i++) {
    digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      digest,
    );
  }
  return digest;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt,
  };
}

async function readCredential(): Promise<StoredCredential | null> {
  const raw = await SecureStore.getItemAsync(CREDENTIAL_KEY);
  return raw ? (JSON.parse(raw) as StoredCredential) : null;
}

/** Local-only implementation: profile in SQLite, salted+stretched hash in SecureStore. */
class LocalAccountBackend implements AccountBackend {
  async hasAccount(): Promise<boolean> {
    return (await readCredential()) !== null;
  }

  async getSessionUserId(): Promise<string | null> {
    return SecureStore.getItemAsync(SESSION_KEY);
  }

  async register({ username, email, password }: RegisterInput): Promise<User> {
    if (await readCredential()) {
      throw new AccountError('An account already exists on this device.');
    }
    const name = username.trim();
    const mail = email?.trim() ? email.trim().toLowerCase() : null;

    const userId = Crypto.randomUUID();
    const salt = toHex(Crypto.getRandomBytes(16));
    const hash = await hashPassword(password, salt);

    try {
      db.insert(users)
        .values({ id: userId, username: name, email: mail })
        .run();
    } catch {
      // The only constraints are the unique username/email indexes.
      throw new AccountError('That username or email is already taken.');
    }

    const credential: StoredCredential = { userId, salt, hash };
    await SecureStore.setItemAsync(CREDENTIAL_KEY, JSON.stringify(credential));
    await SecureStore.setItemAsync(SESSION_KEY, userId);

    const row = db.select().from(users).where(eq(users.id, userId)).get();
    if (!row) throw new AccountError('Failed to create the account.');
    return toUser(row);
  }

  async login({ identifier, password }: LoginInput): Promise<User> {
    const credential = await readCredential();
    if (!credential) {
      throw new AccountError('No account exists on this device yet.');
    }

    const row = db
      .select()
      .from(users)
      .where(eq(users.id, credential.userId))
      .get();
    if (!row) throw new AccountError('Account profile is missing.');

    const id = identifier.trim().toLowerCase();
    const matches =
      id === row.username.toLowerCase() ||
      (row.email !== null && id === row.email.toLowerCase());
    if (!matches) {
      throw new AccountError('No account found for that username or email.');
    }

    const hash = await hashPassword(password, credential.salt);
    if (hash !== credential.hash) {
      throw new AccountError('Incorrect password.');
    }

    await SecureStore.setItemAsync(SESSION_KEY, credential.userId);
    return toUser(row);
  }

  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }

  async changePassword({
    current,
    next,
  }: {
    current: string;
    next: string;
  }): Promise<void> {
    const credential = await readCredential();
    if (!credential) throw new AccountError('No account on this device.');

    const currentHash = await hashPassword(current, credential.salt);
    if (currentHash !== credential.hash) {
      throw new AccountError('Current password is incorrect.');
    }

    const salt = toHex(Crypto.getRandomBytes(16));
    const hash = await hashPassword(next, salt);
    const updated: StoredCredential = { userId: credential.userId, salt, hash };
    await SecureStore.setItemAsync(CREDENTIAL_KEY, JSON.stringify(updated));
  }

  async getUser(): Promise<User | null> {
    const userId = await this.getSessionUserId();
    if (!userId) return null;
    const row = db.select().from(users).where(eq(users.id, userId)).get();
    return row ? toUser(row) : null;
  }
}

export const accountBackend: AccountBackend = new LocalAccountBackend();
