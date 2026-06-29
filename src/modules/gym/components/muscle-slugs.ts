import type { Muscle, MuscleView } from '../muscles';

/** A fine muscle's body-data slug and the silhouette views it paints on. */
export interface MuscleSlug {
  slug: string;
  views: readonly MuscleView[];
}

// Each fine muscle → its body-data slug and the views that slug shows on. The
// deltoid slug is split across views (`front_delts` front, `rear_delts` back).
// `side_delts`/`glute_med`/`hip_flexors` light dedicated overlay regions carved
// from their parent (see the `overlay` parts in body-data); `brachialis` shares
// the `biceps` region since it lies directly under it. Pure data (no imports) so
// the slug-coverage invariant is unit-tested in `muscle-slugs.test.ts`.
export const MUSCLE_SLUG: Readonly<Record<Muscle, MuscleSlug>> = {
  chest: { slug: 'chest', views: ['front'] },
  front_delts: { slug: 'deltoids', views: ['front'] },
  side_delts: { slug: 'side-deltoid', views: ['front'] },
  rear_delts: { slug: 'deltoids', views: ['back'] },
  biceps: { slug: 'biceps', views: ['front'] },
  brachialis: { slug: 'biceps', views: ['front'] },
  triceps: { slug: 'triceps', views: ['front', 'back'] },
  forearms: { slug: 'forearm', views: ['front', 'back'] },
  traps: { slug: 'trapezius', views: ['front', 'back'] },
  lats: { slug: 'upper-back', views: ['back'] },
  lower_back: { slug: 'lower-back', views: ['back'] },
  abs: { slug: 'abs', views: ['front'] },
  obliques: { slug: 'obliques', views: ['front'] },
  glutes: { slug: 'gluteal', views: ['back'] },
  glute_med: { slug: 'glute-medius', views: ['back'] },
  quads: { slug: 'quadriceps', views: ['front'] },
  hamstrings: { slug: 'hamstring', views: ['back'] },
  hip_flexors: { slug: 'hip-flexor', views: ['front'] },
  adductors: { slug: 'adductors', views: ['front', 'back'] },
  calves: { slug: 'calves', views: ['front', 'back'] },
};
