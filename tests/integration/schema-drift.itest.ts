import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { beforeEach, describe, expect, it } from 'vitest';

import * as schema from '../../src/core/db/schema';
import { rawSqlite, resetTestDb } from './support/expo-sqlite-shim';

/**
 * Drift guard between the two halves of the "database is composed at BUILD
 * time" contract (see CLAUDE.md): the Drizzle schema barrel (what the app
 * queries against) and the migration `.sql` files (what actually creates the
 * tables). If someone edits a schema table but forgets `pnpm db:generate`, the
 * app compiles and unit tests pass, yet queries hit a column the device DB
 * doesn't have. This asserts every table + column the schema declares exists in
 * a freshly-migrated database. It scales automatically: new modules added to
 * the barrel are covered with no test changes.
 */
describe('schema/migration drift', () => {
  beforeEach(() => {
    resetTestDb();
  });

  // Widen through `unknown`: the barrel's values are a union of very specific
  // table types, so the `SQLiteTable` type guard isn't assignable to each member
  // directly — but it is to `unknown`.
  const tables = (Object.values(schema) as unknown[]).filter(
    (value): value is SQLiteTable => is(value, SQLiteTable),
  );

  it('declares at least the known core + gym tables', () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  it.each(tables.map((table) => [getTableConfig(table).name, table] as const))(
    'table "%s" exists in the migrated DB with all declared columns',
    (tableName, table) => {
      const db = rawSqlite();
      const existing = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get(tableName);
      expect(
        existing,
        `table "${tableName}" is missing — run pnpm db:generate`,
      ).toBeTruthy();

      const actualColumns = new Set(
        (
          db.prepare(`PRAGMA table_info("${tableName}")`).all() as {
            name: string;
          }[]
        ).map((row) => row.name),
      );

      const expectedColumns = getTableConfig(table).columns.map(
        (column) => column.name,
      );
      for (const column of expectedColumns) {
        expect(
          actualColumns.has(column),
          `column "${tableName}.${column}" is in the schema but not the migrated DB — run pnpm db:generate`,
        ).toBe(true);
      }
    },
  );
});
