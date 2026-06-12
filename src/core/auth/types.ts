/**
 * The authenticated account, as the app consumes it. A plain projection of the
 * `users` table profile — never carries the password credential (that lives in
 * SecureStore via the account backend).
 */
export interface User {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  createdAt: Date;
}

/** Fields accepted when creating the device's account. */
export interface RegisterInput {
  username: string;
  email?: string;
  password: string;
}

/** Credentials for an existing account. `identifier` is username or email. */
export interface LoginInput {
  identifier: string;
  password: string;
}

/** A human-readable failure from the account backend (safe to show in UI). */
export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountError';
  }
}
