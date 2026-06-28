import { DarkTheme, type Theme } from '@react-navigation/native';
import type { TextStyle, ViewStyle } from 'react-native';

import { palette } from './tokens';

/** Typed access to the palette for raw-color APIs (icons, status bar, shadows). */
export const colors = palette;
export type AppColors = typeof colors;

/**
 * Navigation theme so native containers and gesture backgrounds match the dark
 * purple ground (avoids white flashes between screens).
 */
export const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.fg,
    border: colors.border,
    notification: colors.danger,
  },
};

/**
 * Soft glow for interactive / primary elements. Defaults to the primary accent;
 * pass a module accent to recolor. iOS renders the colored shadow directly;
 * Android approximates it via elevation (colored on API 28+).
 */
export function glow(
  color: string = colors.primaryGlow,
  opacity = 0.5,
): ViewStyle {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  };
}

/**
 * Rigid typography scale — the single source of truth for type sizing/weight.
 * Numbers/metrics use `tabular-nums` so digits don't jitter as values change
 * (critical for the logger). Keys are stable; screens pick a step, they don't
 * hand-roll font sizes.
 */
export type TypographyStep =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'caption'
  | 'metric';

export const typography: Record<TypographyStep, TextStyle> = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: 0.2 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.4 },
  // Chiseled, tabular numerals for weights/reps/timers.
  metric: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
};
