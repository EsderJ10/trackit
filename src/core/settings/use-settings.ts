import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import {
  type DashboardLayoutEntry,
  parseDashboardLayout,
  reconcileLayout,
  serializeDashboardLayout,
} from '@/core/dashboard/layout';
import { db } from '@/core/db/client';
import { MODULES } from '@/core/module-registry';

import { type AppSettings, type WeightUnit, appSettings } from './schema';

const DEFAULTS: AppSettings = {
  id: 1,
  weightUnit: 'kg',
  dashboardLayout: null,
  updatedAt: new Date(0),
};

/** Live read of the singleton settings row. */
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

/** Live dashboard layout, reconciled against currently-registered modules. */
export function useDashboardLayout(): DashboardLayoutEntry[] {
  const settings = useSettings();
  return useMemo(
    () =>
      reconcileLayout(
        parseDashboardLayout(settings.dashboardLayout),
        MODULES.map((module) => module.meta.id),
      ),
    [settings.dashboardLayout],
  );
}

export function setDashboardLayout(entries: DashboardLayoutEntry[]): void {
  db.update(appSettings)
    .set({
      dashboardLayout: serializeDashboardLayout(entries),
      updatedAt: new Date(),
    })
    .where(eq(appSettings.id, 1))
    .run();
}
