import type { LucideIcon } from 'lucide-react-native';
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
  /** Lucide icon component used for the module's icon. */
  icon: LucideIcon;
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
  /**
   * Optional single root screen, mounted by the core's generic
   * `app/modules/[moduleId]` route. Simple modules provide this; modules that
   * need internal navigation instead ship their own thin route files under
   * `app/modules/<id>/` (which override the generic route). Either way the
   * module is reached at `/modules/<id>`.
   */
  ModuleScreen?: ComponentType;
  /** Optional settings section slotted into the core Settings screen. */
  SettingsPanel?: ComponentType;
  /**
   * Optional data seed (e.g. a default exercise catalog), run after migrations
   * on EVERY launch. Implementations MUST be idempotent — reconcile against
   * existing rows (insert-missing, rename-once) rather than blind-insert — so
   * the catalog can grow over time and reach already-seeded devices. The runner
   * does not guard re-runs.
   */
  seed?: (db: AppDatabase) => Promise<void> | void;
}
