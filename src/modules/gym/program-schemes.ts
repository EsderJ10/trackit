import type { ProgramSchemeChoice } from './queries';

export interface SchemePreset {
  label: string;
  scheme: ProgramSchemeChoice;
  /** Starting rep target used only when first adding the exercise. */
  reps?: number;
}

/**
 * The progression presets offered both when adding an exercise and when changing
 * an existing slot's scheme — one source so the two flows never drift.
 */
export const SCHEME_PRESETS: SchemePreset[] = [
  {
    label: 'Linear · 3 × 5',
    scheme: { type: 'lp', incrementKg: 2.5, failThreshold: 3, deloadPct: 0.1 },
    reps: 5,
  },
  {
    label: 'Double · 3 × 8–12',
    scheme: { type: 'dp', incrementKg: 2.5, minReps: 8, maxReps: 12 },
  },
  {
    label: 'Autoregulated · RPE wave',
    scheme: { type: 'rpe', targetRpe: 8 },
    reps: 8,
  },
];
