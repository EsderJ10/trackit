import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// NOTE: relative imports only in schema files — drizzle-kit bundles them with
// esbuild, which does not resolve tsconfig path aliases.

/**
 * The account that owns this device's data. v1 is strictly **one row** (one
 * account per device); login/identity is local-only. The password credential is
 * NOT stored here — it lives in SecureStore via the account backend; this table
 * holds only the durable, queryable profile.
 *
 * `id` is a UUID (not autoincrement) so it stays collision-free if a cloud
 * provider later merges accounts across devices.
 *
 * SEAM: gym/settings tables are intentionally NOT scoped by `userId` yet — with
 * a single account they don't need it. Multi-user/sync would add a `userId` FK
 * here and a migration assigning existing rows to this account.
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').unique(),
  displayName: text('display_name'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type UserRow = typeof users.$inferSelect;
