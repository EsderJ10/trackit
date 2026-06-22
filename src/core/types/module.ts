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
 * A top-level navigation tab a module contributes to the app's bottom tab bar.
 * The core reads this metadata to render the tab's label/icon, but the actual
 * route file (`app/(tabs)/<name>.tsx`) is physical — Expo Router maps tabs to
 * files — and it imports the module's screen (the `app/` layer is the only place
 * allowed to import a module directly).
 *
 * NOTE — deferred seam: with a single module this maps 1:1 to tab files. A
 * multi-module combiner (name-collision handling, >1 contributor, ordering) is
 * intentionally NOT built yet — wire one module, leave the seam.
 */
export interface ModulePrimaryTab {
  /** Route segment under `app/(tabs)/`, e.g. 'train' | 'history'. */
  name: string;
  /** Tab label. */
  title: string;
  /** Lucide icon component for the tab. */
  icon: LucideIcon;
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
   * Optional top-level navigation tabs this module contributes to the app's
   * bottom tab bar (e.g. gym → Train, History). The core renders the tab
   * chrome from this metadata; the matching route files live under
   * `app/(tabs)/` and import the module's screens.
   */
  primaryTabs?: readonly ModulePrimaryTab[];
  /**
   * Optional read-only section rendered on the core Profile screen, below the
   * user's identity. Modules use this to surface their own stats / gamification
   * (lifetime totals, streaks, …) — the core stays ignorant of what's inside.
   */
  ProfileWidget?: ComponentType<DashboardWidgetProps>;
  /**
   * Optional data seed (e.g. a default exercise catalog), run after migrations
   * on EVERY launch. Implementations MUST be idempotent — reconcile against
   * existing rows (insert-missing, rename-once) rather than blind-insert — so
   * the catalog can grow over time and reach already-seeded devices. The runner
   * does not guard re-runs.
   */
  seed?: (db: AppDatabase) => Promise<void> | void;
}
