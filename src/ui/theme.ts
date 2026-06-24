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
 * Hotter, wider glow for FORGE elements (ForgeButton, mascot core). Defaults to
 * the magma/amber forge-glow; pass `colors.forgeSpark` for success / PR glows.
 * Same shape as `glow()` — a static shadow; animated pulsing layers a separate
 * View on top (see ForgeButton / Mascot) so the pulse uses the RN native driver.
 */
export function forgeGlow(
  color: string = colors.forgeGlow,
  opacity = 0.6,
): ViewStyle {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
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

/**
 * Theme extensibility seam.
 *
 * `ThemeTokens` is the fixed, semantic key set for a FORGE-family theme. Every
 * alternate theme (a future "Cyberpunk", "Classic Iron", …) MUST provide the
 * SAME keys with different values — so consumers reference `forgeTokens.magma`
 * and a theme swap at the root (`activeTheme`) re-skins everything without
 * touching component code. This is intentionally a plain object map (not a
 * provider) for v1; lifting it into Context is a later, non-breaking step.
 */
export interface ThemeTokens {
  stone: string; // darkest ground
  iron: string; // surface
  ironHi: string; // raised surface
  magma: string; // primary hot accent
  magmaBright: string; // pressed / emphasis
  ember: string; // warm idle glow
  glow: string; // glow halo color
  spark: string; // success / PR accent
  sparkGlow: string; // success / PR glow halo
  warning: string; // coaching / missed-target accent
  fg: string; // text on iron
  fgMuted: string; // secondary text
  locked: string; // grayed / unearned
}

const forge: ThemeTokens = {
  stone: palette.forgeStone,
  iron: palette.forgeIron,
  ironHi: palette.forgeIronHi,
  magma: palette.forge,
  magmaBright: palette.forgeBright,
  ember: palette.forgeEmber,
  glow: palette.forgeGlow,
  spark: palette.forgeSpark,
  sparkGlow: palette.forgeSparkGlow,
  warning: palette.warning,
  fg: palette.fg,
  fgMuted: palette.fgMuted,
  locked: palette.forgeLocked,
};

// Future themes plug in here with IDENTICAL keys, e.g.:
//   const cyberpunk: ThemeTokens = { stone: '#0A0E14', magma: '#FF2E97', ... };
// then add to `themes` below and flip `activeTheme`.
export const themes = { forge } satisfies Record<string, ThemeTokens>;
export type ThemeName = keyof typeof themes;

/** The active FORGE-family theme. Swap this one key to re-skin the system. */
export const activeTheme: ThemeName = 'forge';
export const forgeTokens: ThemeTokens = themes[activeTheme];
