import type { ComponentType } from 'react';

import type { AppDatabase } from '@/core/db/client';

/**
 * Identity + presentation metadata for a tracking module. Used to render the
 * dashboard widget header, the module's tab/entry, and its settings section.
 */
export interface ModuleMeta {
  /** Stable, unique, URL-safe id (e.g. 'gym'). Used in routes and seed state. */
  id: string;
  /** Human-readable name shown in the UI (e.g. 'Gym'). */
  name: string;
  /** Short one-line description. */
  description: string;
  /** Ionicons glyph name used for the module's icon. */
  icon: string;
  /** Accent color (hex) for the module's widget/header. */
  color: string;
  /** Semver string for the module; bump when its schema/behavior changes. */
  version: string;
}

export interface DashboardWidgetProps {
  /** The owning module's id, so a shared widget shell can look up its module. */
  moduleId: string;
}

/**
 * The contract every tracking module fulfils. A module is a self-contained
 * feature (gym, finance, habits…) that plugs into the core app by being added
 * to the module registry — the core never imports a module directly except via
 * that registry barrel.
 *
 * IMPORTANT — database boundary: a module's Drizzle tables are NOT registered
 * here. They are composed at BUILD time through the schema barrel
 * (`src/core/db/schema.ts`) which drizzle-kit reads to generate migrations.
 * There is no runtime DDL; adding a module's tables requires `pnpm db:generate`
 * + a rebuild. This interface only covers the runtime-pluggable surface
 * (UI + seed data).
 */
export interface TrackerModule {
  meta: ModuleMeta;
  /** Compact, read-only summary rendered on the dynamic dashboard. */
  DashboardWidget: ComponentType<DashboardWidgetProps>;
  /** The module's root screen, mounted by the core under /modules/[moduleId]. */
  ModuleScreen: ComponentType;
  /** Optional settings section slotted into the core Settings screen. */
  SettingsPanel?: ComponentType;
  /**
   * Optional one-time data seed (e.g. a default exercise catalog), run once
   * after migrations. The runner guarantees idempotency via `module_seed_state`,
   * so implementations may assume they run at most once.
   */
  seed?: (db: AppDatabase) => Promise<void> | void;
}
