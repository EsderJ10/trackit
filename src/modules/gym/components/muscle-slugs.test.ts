import { describe, expect, it } from 'vitest';

import { MUSCLES } from '../muscles';
import { bodyBack, bodyFront } from './body-data';
import { MUSCLE_SLUG } from './muscle-slugs';

// The diagram only lights a muscle if its mapped slug actually exists in that
// view's vendored geometry. These guard against taxonomy/data drift — a renamed
// slug or a new muscle without a region would otherwise fail silently at render.
const SLUGS_BY_VIEW = {
  front: new Set(bodyFront.map((part) => part.slug)),
  back: new Set(bodyBack.map((part) => part.slug)),
} as const;

describe('MUSCLE_SLUG', () => {
  it('maps every fine muscle in the taxonomy', () => {
    for (const muscle of Object.keys(MUSCLES)) {
      expect(MUSCLE_SLUG[muscle as keyof typeof MUSCLE_SLUG]).toBeDefined();
    }
  });

  it('points every muscle at a slug present in each of its views', () => {
    for (const [muscle, { slug, views }] of Object.entries(MUSCLE_SLUG)) {
      for (const view of views) {
        expect(
          SLUGS_BY_VIEW[view].has(slug),
          `${muscle} → "${slug}" is missing from the ${view} silhouette`,
        ).toBe(true);
      }
    }
  });
});
