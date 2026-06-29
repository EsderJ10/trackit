import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Core cross-cutting preferences. Single-row table (id pinned to 1) for a single
 * live query. Module-specific prefs live in their own tables, not here.
 */
export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  weightUnit: text('weight_unit', { enum: ['kg', 'lb'] })
    .notNull()
    .default('kg'),
  /**
   * Home layout as JSON (ordered `{ moduleId, hidden }`). Null = default (all
   * visible in registry order). Parsed/reconciled by `@/core/dashboard/layout`.
   */
  dashboardLayout: text('dashboard_layout'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Records which modules have seeded (first-seed timestamp, audit only). */
export const moduleSeedState = sqliteTable('module_seed_state', {
  moduleId: text('module_id').primaryKey(),
  seededAt: integer('seeded_at', { mode: 'timestamp_ms' }).notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;
export type WeightUnit = AppSettings['weightUnit'];
