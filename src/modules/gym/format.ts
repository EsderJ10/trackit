import type { WeightUnit } from '@/core/settings/schema';
import { toDisplayWeight } from '@/core/settings/units';

/** Format a canonical-kg weight in the user's unit, trimming trailing `.0`. */
export function formatWeight(weightKg: number, unit: WeightUnit): string {
  const display = toDisplayWeight(weightKg, unit);
  const value = Number.isInteger(display) ? `${display}` : display.toFixed(1);
  return `${value} ${unit}`;
}

/** Render a set's logged RPE, or an empty string when none was recorded. */
export function formatRpe(rpe: number | null): string {
  if (rpe == null) return '';
  return `RPE ${Number.isInteger(rpe) ? rpe : rpe.toFixed(1)}`;
}

/** Format a duration in milliseconds as `m:ss` (used by the rest timer). */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Compact relative date for workout history. */
export function formatRelativeDate(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}
