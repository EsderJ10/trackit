import type { WeightUnit } from '@/core/settings/schema';
import { toDisplayWeight } from '@/core/settings/units';

/** Format a canonical-kg weight in the user's unit, trimming trailing `.0`. */
export function formatWeight(weightKg: number, unit: WeightUnit): string {
  const display = toDisplayWeight(weightKg, unit);
  const value = Number.isInteger(display) ? `${display}` : display.toFixed(1);
  return `${value} ${unit}`;
}

/** Compact relative date for workout history. */
export function formatRelativeDate(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}
