import { MODULES } from '@/core/module-registry';
import { moduleSeedState } from '@/core/settings/schema';

import { db } from './client';

/**
 * Runs each registered module's `seed()` on every launch. Module seeds MUST be
 * idempotent (insert-missing / reconcile, never blind bulk-insert) so they can
 * safely re-run — this lets a module's reference data (e.g. the exercise
 * catalog) grow over time and reach already-seeded devices without a reset.
 * The `module_seed_state` row records the first-seed timestamp for audit only
 * (`.onConflictDoNothing()` keeps re-runs harmless). Call after migrations.
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
