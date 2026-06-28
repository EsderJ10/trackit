// Fine-grained muscle taxonomy — the vocabulary an exercise tags as the muscles
// it works (primary vs secondary), and the regions the anatomy diagram
// (`MuscleMap`) lights up. This is INTENTIONALLY separate from the coarse
// `exercises.muscle_group` (Chest/Back/Legs/…) that drives volume landmarks: the
// group is one bucket for picker sorting + weekly-set bands, whereas these fine
// muscles answer "what does this movement actually train, and where on the body".
// Each fine muscle rolls up to exactly one coarse group via `MUSCLES[*].group`,
// so the two systems stay consistent (and a future per-muscle volume view can
// fold fine → coarse for free). DB/native-free so it unit-tests directly.

/** The coarse buckets stored in `exercises.muscle_group`. */
export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Legs'
  | 'Shoulders'
  | 'Arms'
  | 'Core'
  | 'Cardio';

/** Which side of the body a muscle reads on in the anatomy diagram. */
export type MuscleView = 'front' | 'back';

/**
 * Every fine muscle the catalog can tag. Keys are stable snake_case ids stored
 * in `exercises.primary_muscles` / `secondary_muscles` (JSON) — do not rename a
 * key without a data migration. The deltoid is split into three heads
 * (`front_delts` / `side_delts` / `rear_delts`) because that's how pressing,
 * raising, and rowing emphasise it and how a knowledgeable lifter expects it
 * tagged — a lateral raise is a SIDE-delt movement, not a front-delt one.
 * `brachialis` is the elbow flexor under the biceps that hammer/neutral-grip
 * curls bias; `forearms` stays the brachioradialis/grip bucket. `hip_flexors`
 * (iliopsoas) is the prime mover of straight-leg raises; `glute_med` is the
 * abductor the hip-abduction machine actually trains. Some of these share a
 * diagram region with a neighbour (the vendored silhouette has no distinct path
 * for them) — see `muscle-slugs.ts`; the label/legend still names them precisely.
 */
export type Muscle =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'brachialis'
  | 'triceps'
  | 'forearms'
  | 'traps'
  | 'lats'
  | 'lower_back'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'glute_med'
  | 'quads'
  | 'hamstrings'
  | 'hip_flexors'
  | 'adductors'
  | 'calves';

interface MuscleMeta {
  /** Human label for chips, legends, and the diagram caption. */
  label: string;
  /** Coarse group this fine muscle rolls up to (the landmark/volume bucket). */
  group: MuscleGroup;
  /** Which anatomy view the region is drawn on. */
  view: MuscleView;
}

/** Single source of truth: label, coarse-group rollup, and diagram view. */
export const MUSCLES: Readonly<Record<Muscle, MuscleMeta>> = {
  chest: { label: 'Chest', group: 'Chest', view: 'front' },
  front_delts: { label: 'Front Delts', group: 'Shoulders', view: 'front' },
  side_delts: { label: 'Side Delts', group: 'Shoulders', view: 'front' },
  rear_delts: { label: 'Rear Delts', group: 'Shoulders', view: 'back' },
  biceps: { label: 'Biceps', group: 'Arms', view: 'front' },
  brachialis: { label: 'Brachialis', group: 'Arms', view: 'front' },
  triceps: { label: 'Triceps', group: 'Arms', view: 'back' },
  forearms: { label: 'Forearms', group: 'Arms', view: 'front' },
  traps: { label: 'Traps', group: 'Back', view: 'back' },
  lats: { label: 'Lats', group: 'Back', view: 'back' },
  lower_back: { label: 'Lower Back', group: 'Back', view: 'back' },
  abs: { label: 'Abs', group: 'Core', view: 'front' },
  obliques: { label: 'Obliques', group: 'Core', view: 'front' },
  glutes: { label: 'Glutes', group: 'Legs', view: 'back' },
  glute_med: { label: 'Glute Medius', group: 'Legs', view: 'back' },
  quads: { label: 'Quads', group: 'Legs', view: 'front' },
  hamstrings: { label: 'Hamstrings', group: 'Legs', view: 'back' },
  hip_flexors: { label: 'Hip Flexors', group: 'Legs', view: 'front' },
  adductors: { label: 'Adductors', group: 'Legs', view: 'front' },
  calves: { label: 'Calves', group: 'Legs', view: 'back' },
};

/** Type guard / runtime validation for a muscle id read back from the DB. */
export function isMuscle(value: string): value is Muscle {
  return Object.prototype.hasOwnProperty.call(MUSCLES, value);
}

/** Display label for a muscle id (falls back to the raw id if unknown). */
export function muscleLabel(muscle: Muscle): string {
  return MUSCLES[muscle].label;
}

/** The coarse landmark/volume group a fine muscle belongs to. */
export function coarseGroupOf(muscle: Muscle): MuscleGroup {
  return MUSCLES[muscle].group;
}
