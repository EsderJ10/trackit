// Pure RPE/RIR scale helpers. RPE (rate of perceived exertion, 1–10) and RIR
// (reps in reserve, 0–9) are two views of the *same* stored value — `set_logs.rpe`
// always holds canonical RPE, and `rir = 10 − rpe`. The chosen scale
// (`gym_settings.effortScale`) is a presentation concern only, so we convert at
// the UI boundary with these helpers — switching scales re-renders existing
// history correctly instead of relabeling it (mirrors `core/settings/units`).
//
// Kept free of DB/native imports so it can be unit-tested directly.

/** The effort scale the logging/review UI surfaces. */
export type EffortScale = 'rpe' | 'rir';

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Human label for the scale — used as the field placeholder and value prefix. */
export function effortLabel(scale: EffortScale): string {
  return scale === 'rir' ? 'RIR' : 'RPE';
}

/**
 * Valid input bounds in the *display* scale: RPE spans 1–10, RIR spans 0–9
 * (RPE 1 = 9 RIR, RPE 10 = 0 RIR). Used to flag out-of-range entry before it's
 * clamped on blur.
 */
export function effortBounds(scale: EffortScale): { min: number; max: number } {
  return scale === 'rir' ? { min: 0, max: 9 } : { min: 1, max: 10 };
}

/** Canonical RPE → the value to show in the chosen scale (rounded for display). */
export function toDisplayEffort(rpe: number, scale: EffortScale): number {
  return round(scale === 'rir' ? 10 - rpe : rpe, 1);
}

/**
 * A value entered in the chosen scale → canonical RPE for storage, clamped to
 * the 1–10 RPE scale. RIR is inverted (`rpe = 10 − rir`) before clamping.
 */
export function fromDisplayEffort(value: number, scale: EffortScale): number {
  const rpe = scale === 'rir' ? 10 - value : value;
  return Math.min(10, Math.max(1, round(rpe, 1)));
}

/**
 * Parse a text field in the chosen scale into a storable RPE. Empty/blank or
 * unparseable input clears the value (`null`); otherwise convert + clamp.
 */
export function parseEffortInput(
  text: string,
  scale: EffortScale,
): number | null {
  if (text.trim() === '') return null;
  const parsed = Number.parseFloat(text);
  if (Number.isNaN(parsed)) return null;
  return fromDisplayEffort(parsed, scale);
}

/** The field's string value for a stored RPE in the chosen scale (`''` if none). */
export function effortInputValue(
  rpe: number | null,
  scale: EffortScale,
): string {
  return rpe == null ? '' : String(toDisplayEffort(rpe, scale));
}

/** Render a logged set's effort in the chosen scale, e.g. `RPE 8` / `RIR 2`. */
export function formatEffort(rpe: number | null, scale: EffortScale): string {
  if (rpe == null) return '';
  const value = toDisplayEffort(rpe, scale);
  const text = Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return `${effortLabel(scale)} ${text}`;
}
