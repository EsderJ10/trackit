const { palette } = require('./src/ui/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan route files and all module/UI source for className usage.
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: palette.bg,
        surface: {
          DEFAULT: palette.surface,
          alt: palette.surfaceAlt,
          hi: palette.surfaceHi,
        },
        border: {
          DEFAULT: palette.border,
          soft: palette.borderSoft,
        },
        primary: {
          DEFAULT: palette.primary,
          bright: palette.primaryBright,
          soft: palette.primarySoft,
          glow: palette.primaryGlow,
        },
        fg: {
          DEFAULT: palette.fg,
          muted: palette.fgMuted,
          faint: palette.fgFaint,
        },
        success: palette.success,
        danger: palette.danger,
        warning: palette.warning,
        gym: palette.gym,
        finance: palette.finance,
        habits: palette.habits,
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
};
