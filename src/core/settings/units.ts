import type { WeightUnit } from './schema';

/**
 * Weights are stored canonically in **kilograms** everywhere in the database and
 * query layer. The user's chosen display unit (`app_settings.weightUnit`) is a
 * presentation concern only — convert at the UI boundary with these helpers, so
 * switching units re-renders existing history correctly instead of relabeling it.
 */
const LB_PER_KG = 2.2046226218;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Canonical kg → the value to show in the user's unit (rounded for display). */
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  return round(unit === 'lb' ? kg * LB_PER_KG : kg, 1);
}

/** A value entered in the user's unit → canonical kg for storage. */
export function fromDisplayWeight(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? round(value / LB_PER_KG, 2) : value;
}
