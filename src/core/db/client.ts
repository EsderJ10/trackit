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

export const db = drizzle(expoDb, { schema });

/** The fully-typed Drizzle database, including every module's tables. */
export type AppDatabase = typeof db;
