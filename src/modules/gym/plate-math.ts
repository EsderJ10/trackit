// Plate calculator — plates per side of the bar for a target weight. All weights
// are in the DISPLAY unit (kg or lb), not canonical kg: plates are physical
// denominations the lifter owns, so the caller passes a unit-appropriate bar/set.

/** Default bar weight by unit (Olympic bar). */
export const DEFAULT_BAR: Record<'kg' | 'lb', number> = { kg: 20, lb: 45 };

/** Default plate denominations (per single plate) by unit, largest first. */
export const DEFAULT_PLATES: Record<'kg' | 'lb', readonly number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

export interface PlatePlan {
  /** Plates for ONE side, largest first. */
  plates: number[];
  /** The total weight actually achievable with these plates (both sides + bar). */
  achieved: number;
  /** True when `achieved` hits the target exactly. */
  exact: boolean;
}

/**
 * Greedy per-side plate breakdown for `target`, assuming unlimited plates. When
 * the remainder can't match exactly, returns the closest achievable AT OR BELOW
 * target (never overloads) with `exact: false`.
 */
export function platesPerSide(
  target: number,
  bar: number,
  plates: readonly number[] = DEFAULT_PLATES.kg,
): PlatePlan {
  if (target <= bar) {
    return { plates: [], achieved: bar, exact: target === bar };
  }
  const denoms = [...plates].sort((a, b) => b - a);
  let perSide = (target - bar) / 2;
  const used: number[] = [];
  // Tiny epsilon so float subtraction (2.5, 1.25…) doesn't strand a plate.
  const eps = 1e-9;
  for (const plate of denoms) {
    while (perSide + eps >= plate) {
      used.push(plate);
      perSide -= plate;
    }
  }
  const achieved = bar + 2 * used.reduce((sum, p) => sum + p, 0);
  return { plates: used, achieved, exact: Math.abs(achieved - target) < 1e-6 };
}

/** Collapse a per-side plate list into `{ plate, count }` pairs for display. */
export function summarisePlates(
  plates: number[],
): { plate: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const p of plates) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts.entries()]
    .map(([plate, count]) => ({ plate, count }))
    .sort((a, b) => b.plate - a.plate);
}
