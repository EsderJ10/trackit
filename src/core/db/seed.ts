import { eq } from 'drizzle-orm';

import { MODULES } from '@/core/module-registry';
import { moduleSeedState } from '@/core/settings/schema';

import { db } from './client';

/**
 * Runs each registered module's `seed()` exactly once across the app's
 * lifetime, guarded by the `module_seed_state` table. Safe to call on every
 * launch — already-seeded modules are skipped. Call after migrations succeed.
 */
export async function runModuleSeeds(): Promise<void> {
  for (const module of MODULES) {
    if (!module.seed) continue;

    const already = db
      .select({ moduleId: moduleSeedState.moduleId })
      .from(moduleSeedState)
      .where(eq(moduleSeedState.moduleId, module.meta.id))
      .get();
    if (already) continue;

    await module.seed(db);

    db.insert(moduleSeedState)
      .values({ moduleId: module.meta.id, seededAt: new Date() })
      .run();
  }
}
