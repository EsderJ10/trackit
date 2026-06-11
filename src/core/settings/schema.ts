import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Core, cross-cutting preferences. Single-row table (id is pinned to 1) so the
 * UI can read settings with a single live query. Module-specific preferences
 * live in their own module tables, not here.
 */
export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  weightUnit: text('weight_unit', { enum: ['kg', 'lb'] })
    .notNull()
    .default('kg'),
  theme: text('theme', { enum: ['system', 'light', 'dark'] })
    .notNull()
    .default('system'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * Tracks which modules have run their one-time `seed()` so seeding is idempotent
 * across app launches. Written by the seed runner after a module seeds.
 */
export const moduleSeedState = sqliteTable('module_seed_state', {
  moduleId: text('module_id').primaryKey(),
  seededAt: integer('seeded_at', { mode: 'timestamp_ms' }).notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;
export type WeightUnit = AppSettings['weightUnit'];
export type ThemePreference = AppSettings['theme'];
