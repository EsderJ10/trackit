import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * The authentication seam. v1 is a purely-local PIN + biometric lock, but the
 * core only ever talks to this interface — a cloud provider (Supabase/Clerk)
 * can be dropped in later by implementing `AuthBackend` without touching the
 * lock UI or the store.
 */
export interface AuthBackend {
  /** Whether an app-lock PIN has been configured. */
  isLockEnabled(): Promise<boolean>;
  /** Set (or replace) the app-lock PIN. */
  setPin(pin: string): Promise<void>;
  /** Remove the app lock entirely. */
  clearLock(): Promise<void>;
  /** Check a PIN against the stored credential. */
  verifyPin(pin: string): Promise<boolean>;
  /** Whether device biometrics are available and enrolled. */
  canUseBiometrics(): Promise<boolean>;
  /** Prompt device biometrics; resolves true on success. */
  authenticateBiometric(): Promise<boolean>;
}

const LOCK_KEY = 'trackit.lock.v1';

interface StoredLock {
  salt: string;
  hash: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`,
  );
}

/** Local-only implementation: salted SHA-256 PIN in SecureStore + biometrics. */
class LocalAuthBackend implements AuthBackend {
  async isLockEnabled(): Promise<boolean> {
    return (await SecureStore.getItemAsync(LOCK_KEY)) !== null;
  }

  async setPin(pin: string): Promise<void> {
    const salt = toHex(Crypto.getRandomBytes(16));
    const hash = await hashPin(pin, salt);
    const record: StoredLock = { salt, hash };
    await SecureStore.setItemAsync(LOCK_KEY, JSON.stringify(record));
  }

  async clearLock(): Promise<void> {
    await SecureStore.deleteItemAsync(LOCK_KEY);
  }

  async verifyPin(pin: string): Promise<boolean> {
    const raw = await SecureStore.getItemAsync(LOCK_KEY);
    if (!raw) return false;
    const { salt, hash } = JSON.parse(raw) as StoredLock;
    return (await hashPin(pin, salt)) === hash;
  }

  async canUseBiometrics(): Promise<boolean> {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && enrolled;
  }

  async authenticateBiometric(): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock TrackIt',
      fallbackLabel: 'Use PIN',
    });
    return result.success;
  }
}

export const authBackend: AuthBackend = new LocalAuthBackend();
