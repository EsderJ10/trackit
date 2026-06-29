import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect } from 'react';

import { appSettings } from '../settings/schema';
import { db } from './client';
import migrations from './migrations/migrations';
import { runModuleSeeds } from './seed';

export interface DatabaseReadyState {
  ready: boolean;
  error: Error | undefined;
}

/** Applies pending migrations on startup and ensures the singleton settings row exists. */
export function useDatabaseReady(): DatabaseReadyState {
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (!success) return;
    db.insert(appSettings).values({ id: 1 }).onConflictDoNothing().run();
    void runModuleSeeds();
  }, [success]);

  return { ready: success, error };
}
