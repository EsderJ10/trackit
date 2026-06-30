import type { LucideIcon } from 'lucide-react-native';
import type { ComponentType } from 'react';

import type { AppDatabase } from '@/core/db/client';

/** Identity + presentation metadata for a tracking module. */
export interface ModuleMeta {
  /** Stable, unique, URL-safe id (e.g. 'gym'). Used in routes and seed state. */
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Accent color (hex) for the module's widget/header. */
  color: string;
  /** Semver; bump when schema/behavior changes. */
  version: string;
}

export interface DashboardWidgetProps {
  /** The owning module's id, so a shared widget shell can look it up. */
  moduleId: string;
}

/**
 * A bottom-tab a module contributes. The route file (`app/(tabs)/<name>.tsx`) is
 * physical and imports the module's screen (the `app/` layer is the only place
 * allowed to import a module directly).
 *
 * Deferred seam: a multi-module combiner (collisions, ordering) is NOT built yet.
 */
export interface ModulePrimaryTab {
  /** Route segment under `app/(tabs)/`, e.g. 'train' | 'history'. */
  name: string;
  title: string;
  icon: LucideIcon;
}

/**
 * The contract every tracking module fulfils — a self-contained feature plugged
 * in via the registry barrel (core never imports a module directly otherwise).
 *
 * Database boundary: a module's Drizzle tables are NOT registered here. They are
 * composed at BUILD time via the schema barrel (`src/core/db/schema.ts`); there
 * is no runtime DDL (adding tables needs `pnpm db:generate` + a rebuild). This
 * interface covers only the runtime-pluggable surface (UI + seed data).
 */
export interface TrackerModule {
  meta: ModuleMeta;
  /** Compact read-only summary on the dynamic dashboard. */
  DashboardWidget: ComponentType<DashboardWidgetProps>;
  /**
   * Optional root screen for the generic `app/modules/[moduleId]` route. Modules
   * needing internal nav instead ship route files under `app/modules/<id>/`
   * (overriding the generic route). Either way reached at `/modules/<id>`.
   */
  ModuleScreen?: ComponentType;
  /**
   * True when the module owns a nested route stack under `app/modules/<id>/`. The
   * root layout reads this to register a protected `<Stack.Screen>` per module —
   * no core hand-edit beyond the registry line. Mutually exclusive with `ModuleScreen`.
   */
  ownsRouteStack?: boolean;
  /** Optional settings section slotted into the core Settings screen. */
  SettingsPanel?: ComponentType;
  /**
   * Optional bottom-tabs this module contributes (e.g. gym → Train, History).
   * Route files live under `app/(tabs)/` and import the module's screens.
   */
  primaryTabs?: readonly ModulePrimaryTab[];
  /** Optional read-only section on the core Profile screen (module stats/streaks). */
  ProfileWidget?: ComponentType<DashboardWidgetProps>;
  /**
   * Optional persistent bar pinned above the bottom tab bar on every tab screen
   * (e.g. gym's "resume workout" banner). Core renders each module's bar straight
   * from the registry — no core edit per module. MUST render null when idle.
   */
  GlobalBar?: ComponentType;
  /**
   * Optional data seed, run after migrations on EVERY launch. MUST be idempotent
   * (insert-missing/rename-once, never blind-insert) so it can grow over time and
   * reach already-seeded devices. The runner does not guard re-runs.
   */
  seed?: (db: AppDatabase) => Promise<void> | void;
}
