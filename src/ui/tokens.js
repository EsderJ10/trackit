// Single source of truth for the TrackIt color palette.
//
// Consumed in two places:
//   - tailwind.config.js  (NativeWind className colors)
//   - src/ui/theme.ts      (typed colors for raw-color APIs: status bar,
//                           navigation theme, glow shadows, icon tint)
//
// This is plain CommonJS JS on purpose so Tailwind (which evaluates its config
// in Node, without the TS pipeline) can `require()` it.

/**
 * Dark *purple* framework — deliberately not pitch black, so the UI keeps a
 * sense of lift and brightness. Surfaces step up in lightness; accents glow.
 */
const palette = {
  // App chrome
  bg: '#1C1833',
  surface: '#272247',
  surfaceAlt: '#2F2A55',
  surfaceHi: '#3A3468',
  border: '#3D3770',
  borderSoft: '#322C5A',

  // Primary accent (Liftosaur-inspired indigo-purple)
  primary: '#4B5694',
  primaryBright: '#6675C4',
  primarySoft: '#4A4466',
  primaryGlow: '#7B8AE6',

  // Text / foreground (high contrast on the dark purple ground)
  fg: '#F4F3FB',
  fgMuted: '#ABA7CE',
  fgFaint: '#79759E',

  // Feedback
  success: '#43C892',
  danger: '#EC6A8C',
  warning: '#E4AC63',

  // Per-module accents — each module picks one so users instantly know where
  // they are. Core stays purple; modules diverge by accent only.
  gym: '#8B7FF0',
  finance: '#43C892',
  habits: '#2DD4BF',
};

module.exports = { palette };
