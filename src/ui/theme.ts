import { DarkTheme, type Theme } from '@react-navigation/native';
import type { TextStyle, ViewStyle } from 'react-native';

import { palette } from './tokens';

/** Typed access to the palette for raw-color APIs (icons, status bar, shadows). */
export const colors = palette;
export type AppColors = typeof colors;

/** Navigation theme matching the dark purple ground (avoids white flashes between screens). */
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

/** Soft glow for interactive/primary elements. iOS renders the colored shadow; Android approximates via elevation (colored on API 28+). */
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

/** 6-digit hex `color` at `alpha` (0–1) as 8-digit hex — for soft accent fills without hand-writing hex-alpha suffixes. */
export function tint(color: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const suffix = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${suffix}`;
}

/** Shared header/content chrome for module nav stacks (incl. the dark-bg white-flash guard), so each `_layout.tsx` is a one-line delegation. */
export const moduleStackScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.fg,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};

/** Single source of truth for type sizing/weight. `metric` uses `tabular-nums` so digits don't jitter as values change (critical for the logger). */
export type TypographyStep =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'caption'
  | 'metric';

export const typography: Record<TypographyStep, TextStyle> = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  metric: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
};
