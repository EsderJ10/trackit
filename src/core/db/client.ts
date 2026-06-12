import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DB_NAME = 'trackit.db';

/**
 * `enableChangeListener` is required for Drizzle's `useLiveQuery` to react to
 * writes — keep it on. The database is opened synchronously at module load so
 * `db` is ready before the first query.
 */
const expoDb = openDatabaseSync(DB_NAME, { enableChangeListener: true });

// expo-sqlite opens connections with foreign keys OFF — enable enforcement so
// our onDelete cascade / set-null rules actually fire (e.g. deleting a session
// removes its set logs instead of orphaning them).
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });

/**
 * The raw expo-sqlite handle, for the rare low-level need the Drizzle layer
 * doesn't model — e.g. module-agnostic backup/restore that introspects
 * `sqlite_master` to dump every table. Writes here still fire the change
 * listener, so `useLiveQuery` stays reactive. Prefer `db` for everything else.
 */
export const sqlite = expoDb;

/** The fully-typed Drizzle database, including every module's tables. */
export type AppDatabase = typeof db;
