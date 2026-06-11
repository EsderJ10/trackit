import type { WeightUnit } from '@/core/settings/schema';

/** Format a weight value with the user's unit, trimming trailing `.0`. */
export function formatWeight(weight: number, unit: WeightUnit): string {
  const value = Number.isInteger(weight) ? `${weight}` : weight.toFixed(1);
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
