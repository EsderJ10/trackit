import Database from 'better-sqlite3';

import { applyMigrations } from './apply-migrations';

/**
 * A Node-side stand-in for Expo's native `expo-sqlite`, aliased in by the
 * integration Vitest project (see `vitest.config.ts`). Crucially this does NOT
 * replace `@/core/db/client` or the Drizzle driver — the app's real client and
 * the real `drizzle-orm/expo-sqlite` session run unchanged on top of this. Only
 * the native engine underneath is swapped for an in-memory better-sqlite3, so
 * the exact code path that ships (including Expo-specific result shapes like
 * `lastInsertRowId`) is what gets exercised.
 *
 * The single wrapper object returned by `openDatabaseSync` keeps a stable
 * identity while `resetTestDb()` swaps the engine underneath it, giving each
 * test a pristine, freshly-migrated database with zero cross-contamination —
 * without the app-held `db`/`sqlite` references ever going stale.
 */

// Rows come back keyed by column name with driver-native value types.
type Row = Record<string, unknown>;

// The subset of Expo's `SQLiteExecuteSyncResult` that drizzle-orm/expo-sqlite
// consumes (see its session.cjs: run/all/get/values).
interface ExecuteResult {
  changes: number;
  lastInsertRowId: number;
  getAllSync(): Row[];
  getFirstSync(): Row | undefined;
}

interface RawExecuteResult {
  getAllSync(): unknown[][];
}

interface FakeStatement {
  executeSync(params: unknown[]): ExecuteResult;
  executeForRawResultSync(params: unknown[]): RawExecuteResult;
}

interface FakeExpoDatabase {
  prepareSync(sql: string): FakeStatement;
  execSync(sql: string): void;
}

let engine: Database.Database | undefined;

function freshEngine(): Database.Database {
  const db = new Database(':memory:');
  // expo-sqlite opens with foreign keys OFF; the app turns them ON in its
  // client. Mirror that so cascade / set-null behaviour matches the device.
  db.pragma('foreign_keys = ON');
  applyMigrations(db);
  return db;
}

function currentEngine(): Database.Database {
  engine ??= freshEngine();
  return engine;
}

function prepare(db: Database.Database, sql: string): FakeStatement {
  return {
    executeSync(params: unknown[]): ExecuteResult {
      const stmt = db.prepare(sql);
      if (stmt.reader) {
        const rows = stmt.all(...params) as Row[];
        return {
          changes: 0,
          lastInsertRowId: 0,
          getAllSync: () => rows,
          getFirstSync: () => rows[0],
        };
      }
      const info = stmt.run(...params);
      return {
        changes: info.changes,
        lastInsertRowId: Number(info.lastInsertRowid),
        getAllSync: () => [],
        getFirstSync: () => undefined,
      };
    },
    executeForRawResultSync(params: unknown[]): RawExecuteResult {
      const rows = db
        .prepare(sql)
        .raw(true)
        .all(...params) as unknown[][];
      return { getAllSync: () => rows };
    },
  };
}

const database: FakeExpoDatabase = {
  prepareSync(sql: string): FakeStatement {
    // Bind to whatever engine is current at prepare time; drizzle prepares a
    // fresh statement per query, so a reset between tests is picked up.
    return prepare(currentEngine(), sql);
  },
  execSync(sql: string): void {
    currentEngine().exec(sql);
  },
};

// --- Expo `expo-sqlite` module surface (what the app + driver import) ---

export function openDatabaseSync(): FakeExpoDatabase {
  currentEngine();
  return database;
}

/** No-op: `useLiveQuery`'s change listener is never invoked in headless tests. */
export function addDatabaseChangeListener(): { remove(): void } {
  return { remove: () => {} };
}

// --- Test-only helpers (imported by *.itest.ts via the relative path) ---

/** Reset to a pristine, freshly-migrated in-memory database. Call in beforeEach. */
export function resetTestDb(): void {
  engine?.close();
  engine = freshEngine();
}

/** The raw better-sqlite3 handle, for assertions that bypass Drizzle. */
export function rawSqlite(): Database.Database {
  return currentEngine();
}
