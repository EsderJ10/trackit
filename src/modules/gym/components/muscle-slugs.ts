import type { Muscle, MuscleView } from '../muscles';

/** A fine muscle's body-data slug and the silhouette views it paints on. */
export interface MuscleSlug {
  slug: string;
  views: readonly MuscleView[];
}

/**
 * Maps each fine muscle to the body-data slug it paints and the views that slug
 * shows on. The deltoid is a single slug split across views — `front_delts`
 * paints only on the front and `rear_delts` only on the back — while muscles
 * whose slug is drawn on both silhouettes (forearm, calves, triceps…) light up
 * wherever they appear. Pure data (no React/native imports) so the
 * slug-coverage invariant is unit-tested in `muscle-slugs.test.ts`.
 *
 * DISTINCT OVERLAYS: `side_delts`, `glute_med`, and `hip_flexors` each light a
 * dedicated overlay region carved from their parent (`side-deltoid` from the
 * deltoid cap, `glute-medius` from the gluteal mass, `hip-flexor` at the hip
 * crease) — see the `overlay` parts in `body-data.ts`. `brachialis` still shares
 * the `biceps` region (it lies directly under the biceps, so a distinct path
 * would only overlap it). The legend always names each muscle precisely.
 */
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
