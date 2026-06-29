import { gymModule } from '@/modules/gym';

import type { TrackerModule } from '@/core/types/module';

/**
 * Module registry — the ONLY place core references concrete modules; drives the
 * dashboard, module routes, and settings. Add a module in two steps:
 *   1. add its `TrackerModule` to this array, and
 *   2. add its schema in `src/core/db/schema.ts` + run `pnpm db:generate`.
 */
export const MODULES: readonly TrackerModule[] = [gymModule];

export function getModule(id: string): TrackerModule | undefined {
  return MODULES.find((module) => module.meta.id === id);
}
