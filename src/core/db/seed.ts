import { MODULES } from '@/core/module-registry';
import { moduleSeedState } from '@/core/settings/schema';

import { db } from './client';

/**
 * Runs each module's `seed()` on every launch (call AFTER migrations). Seeds MUST
 * be idempotent (insert-missing/reconcile, never blind bulk-insert) so reference
 * data can grow and reach already-seeded devices. `module_seed_state` records the
 * first-seed timestamp for audit only; the runner does not guard re-runs.
 */
export async function runModuleSeeds(): Promise<void> {
  for (const module of MODULES) {
    if (!module.seed) continue;

    await module.seed(db);

    db.insert(moduleSeedState)
      .values({ moduleId: module.meta.id, seededAt: new Date() })
      .onConflictDoNothing()
      .run();
  }
}
