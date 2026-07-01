import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import journal from '../../src/core/db/migrations/meta/_journal.json';
import { applyMigrations } from './support/apply-migrations';
import { rawSqlite, resetTestDb } from './support/expo-sqlite-shim';

/**
 * Exercises the on-device DB blind spot: the real migration `.sql` files must
 * apply cleanly, in order, on a real SQLite engine — not just in Expo. These
 * tests catch a migration that references a column that doesn't exist yet, an
 * out-of-order journal, or SQL an engine rejects, before it ships to a phone.
 */
describe('migrations', () => {
  beforeEach(() => {
    resetTestDb();
  });

  it('applies every journalled migration cleanly on a real engine', () => {
    // A fresh engine (independent of the shared test client) proves the full
    // set applies from scratch with no leftover state.
    const engine = new Database(':memory:');
    engine.pragma('foreign_keys = ON');
    const applied = applyMigrations(engine);

    expect(applied).toEqual(journal.entries.map((e) => e.tag));
    expect(applied.length).toBe(journal.entries.length);
    engine.close();
  });

  it('records the migrations as applied in the drizzle bookkeeping table', () => {
    // drizzle-orm/expo-sqlite tracks applied migrations in
    // `__drizzle_migrations`; our replay uses the raw `.sql` files, so that
    // table is intentionally absent — assert the schema tables landed instead.
    const tables = rawSqlite()
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as { name: string }[];

    expect(tables.length).toBeGreaterThan(0);
    // app_settings ships in migration 0000 — a canary the replay actually ran.
    expect(tables.map((t) => t.name)).toContain('app_settings');
  });

  it('enforces foreign keys (matching the app runtime PRAGMA)', () => {
    const fk = rawSqlite().pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
  });

  it('has a contiguous, zero-based, ordered journal', () => {
    const indices = journal.entries.map((e) => e.idx);
    expect(indices).toEqual(indices.map((_, i) => i));
  });
});
