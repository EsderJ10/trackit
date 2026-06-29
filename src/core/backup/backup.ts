import journal from '@/core/db/migrations/meta/_journal.json';
import { sqlite } from '@/core/db/client';

import {
  type BackupRow,
  type BackupTables,
  type SqlValue,
  parseBackup,
  serializeBackup,
} from './format';

// Excluded from backups:
// - `users` — credential lives in SecureStore, so a restored profile can't re-create
//   a login and its UNIQUE username would block re-registering. Tracking data isn't
//   user-scoped, so it restores under whatever account exists on the device.
// - `__drizzle_migrations` / `sqlite_%` — engine + migration bookkeeping.
const EXCLUDED_TABLES = new Set(['users', '__drizzle_migrations']);

/** The latest applied migration tag; a backup only restores onto a matching one. */
export const SCHEMA_VERSION: string =
  journal.entries[journal.entries.length - 1]?.tag ?? 'unknown';

function backedUpTableNames(): string[] {
  const rows = sqlite.getAllSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  return rows
    .map((row) => row.name)
    .filter((name) => !EXCLUDED_TABLES.has(name))
    .sort();
}

export function exportBackup(now: number): string {
  const tables: BackupTables = {};
  for (const name of backedUpTableNames()) {
    tables[name] = sqlite.getAllSync<BackupRow>(`SELECT * FROM "${name}"`);
  }
  return serializeBackup({
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    tables,
  });
}

export type RestoreResult =
  | { ok: true; tableCount: number; rowCount: number }
  | { ok: false; error: string };

/**
 * Replace all tracking data with a backup (schema-version gated), wiping and
 * re-inserting in one transaction. FK enforcement is toggled OFF *outside* the
 * transaction (the pragma is a no-op mid-transaction in SQLite); `finally`
 * restores it even if the transaction throws.
 */
export function restoreBackup(json: string): RestoreResult {
  const parsed = parseBackup(json, SCHEMA_VERSION);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const { tables } = parsed.envelope;
  const names = Object.keys(tables);

  sqlite.execSync('PRAGMA foreign_keys = OFF;');
  try {
    let rowCount = 0;
    sqlite.withTransactionSync(() => {
      for (const name of names) {
        sqlite.runSync(`DELETE FROM "${name}"`);
      }
      for (const name of names) {
        for (const row of tables[name] ?? []) {
          insertRow(name, row);
          rowCount += 1;
        }
      }
    });
    return { ok: true, tableCount: names.length, rowCount };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Restore failed.',
    };
  } finally {
    sqlite.execSync('PRAGMA foreign_keys = ON;');
  }
}

function insertRow(table: string, row: BackupRow): void {
  const columns = Object.keys(row);
  if (columns.length === 0) return;
  const columnList = columns.map((column) => `"${column}"`).join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  // Explicit ids (not autoincrement) so restored rows keep their FK relationships.
  const values: SqlValue[] = columns.map((column) => row[column] ?? null);
  sqlite.runSync(
    `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders})`,
    ...values,
  );
}
