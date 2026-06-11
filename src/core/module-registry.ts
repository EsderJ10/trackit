import { gymModule } from '@/modules/gym';

import type { TrackerModule } from '@/core/types/module';

/**
 * The central module registry. This is the ONLY place the core references
 * concrete modules. Plugging in a new tracking module is a two-step change:
 *   1. add its `TrackerModule` export to this array, and
 *   2. uncomment its schema in `src/core/db/schema.ts` + run `pnpm db:generate`.
 * The dashboard, module routes, and settings are all driven by this list.
 */
export const MODULES: readonly TrackerModule[] = [gymModule];

/** Look up a registered module by its id. */
export function getModule(id: string): TrackerModule | undefined {
  return MODULES.find((module) => module.meta.id === id);
}
