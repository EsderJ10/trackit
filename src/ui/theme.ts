// Expo Router 56 vendors the navigation theme (it moved off @react-navigation).
import { DarkTheme } from 'expo-router';
import type { ViewStyle } from 'react-native';

import { palette } from './tokens';

/** Typed access to the palette for raw-color APIs (icons, status bar, shadows). */
export const colors = palette;
export type AppColors = typeof colors;

/**
 * Navigation theme so native containers and gesture backgrounds match the dark
 * purple ground (avoids white flashes between screens).
 */
export const navigationTheme: typeof DarkTheme = {
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
export function glow(color: string = colors.primaryGlow, opacity = 0.5): ViewStyle {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  };
}
