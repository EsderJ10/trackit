import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Relative imports only: drizzle-kit bundles schema with esbuild, which ignores
// tsconfig path aliases.

/**
 * Account that owns this device's data — strictly one row in v1. Holds only the
 * durable profile; the password credential lives in SecureStore, not here.
 * `id` is a UUID (not autoincrement) to stay collision-free if a cloud provider
 * later merges accounts across devices.
 * SEAM: gym/settings tables are NOT scoped by `userId` yet (single account).
 * Multi-user/sync would add a `userId` FK and a migration backfilling rows.
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
