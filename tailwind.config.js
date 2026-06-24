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
        // FORGE branding layer — additive (see src/ui/tokens.js).
        forge: {
          DEFAULT: palette.forge,
          bright: palette.forgeBright,
          glow: palette.forgeGlow,
          ember: palette.forgeEmber,
          stone: palette.forgeStone,
          iron: palette.forgeIron,
          'iron-hi': palette.forgeIronHi,
          spark: palette.forgeSpark,
          'spark-glow': palette.forgeSparkGlow,
          locked: palette.forgeLocked,
        },
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
