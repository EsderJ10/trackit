import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/core/db/client';

import {
  type AppSettings,
  type ThemePreference,
  type WeightUnit,
  appSettings,
} from './schema';

const DEFAULTS: AppSettings = {
  id: 1,
  weightUnit: 'kg',
  theme: 'system',
  updatedAt: new Date(0),
};

/** Live, reactive read of the singleton settings row. */
export function useSettings(): AppSettings {
  const { data } = useLiveQuery(
    db.select().from(appSettings).where(eq(appSettings.id, 1)),
  );
  return data[0] ?? DEFAULTS;
}

export function setWeightUnit(weightUnit: WeightUnit): void {
  db.update(appSettings)
    .set({ weightUnit, updatedAt: new Date() })
    .where(eq(appSettings.id, 1))
    .run();
}

export function setThemePreference(theme: ThemePreference): void {
  db.update(appSettings)
    .set({ theme, updatedAt: new Date() })
    .where(eq(appSettings.id, 1))
    .run();
}
