import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DB_NAME = 'trackit.db';

// `enableChangeListener` required for `useLiveQuery` to react to writes — keep on.
// Opened synchronously at module load so `db` is ready before the first query.
const expoDb = openDatabaseSync(DB_NAME, { enableChangeListener: true });

// expo-sqlite opens with foreign keys OFF — enable so onDelete cascade/set-null fire.
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });

/**
 * Raw expo-sqlite handle for low-level needs Drizzle doesn't model (e.g. backup
 * introspecting `sqlite_master`). Writes still fire the change listener. Prefer `db`.
 */
export const sqlite = expoDb;

export type AppDatabase = typeof db;
