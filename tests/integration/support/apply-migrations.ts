import type BetterSqlite3 from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import journal from '../../../src/core/db/migrations/meta/_journal.json';

const MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../src/core/db/migrations',
);

/**
 * Replays the app's real Drizzle `.sql` migrations onto a Node SQLite engine,
 * in the exact order recorded in `_journal.json`. Statements are split on the
 * `--> statement-breakpoint` markers drizzle-kit emits — the same contract the
 * on-device `drizzle-orm/expo-sqlite` migrator uses — so a migration that only
 * works because of an Expo quirk (or breaks on a real engine) is caught here
 * rather than on a user's phone. Returns the ordered migration tags applied.
 */
export function applyMigrations(sqlite: BetterSqlite3.Database): string[] {
  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

  for (const entry of entries) {
    const sql = readFileSync(
      resolve(MIGRATIONS_DIR, `${entry.tag}.sql`),
      'utf8',
    );
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.exec(trimmed);
    }
  }

  return entries.map((entry) => entry.tag);
}
