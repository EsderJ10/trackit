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
 * Identity seam (IDENTITY counterpart to `backend.ts`'s device-LOCK `AuthBackend`).
 * v1 is local-only: one account per device, hashed on-device. A cloud provider
 * (Supabase/Clerk) can implement this without touching login UI or session store.
 */
export interface AccountBackend {
  hasAccount(): Promise<boolean>;
  /** Signed-in user id, or null when logged out. Persists across restarts. */
  getSessionUserId(): Promise<string | null>;
  register(input: RegisterInput): Promise<User>;
  login(input: LoginInput): Promise<User>;
  logout(): Promise<void>;
  changePassword(input: { current: string; next: string }): Promise<void>;
  getUser(): Promise<User | null>;
}

const CREDENTIAL_KEY = 'trackit.account.v1';
const SESSION_KEY = 'trackit.session.v1';

// expo-crypto has no PBKDF2/bcrypt, so stretch a salted SHA-256. Modest count to
// stay responsive on-device — real KDF hashing is the future cloud backend's job.
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
