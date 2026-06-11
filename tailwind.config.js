/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan route files and all module/UI source for className usage.
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    // Design tokens (colors, spacing, fonts) are intentionally left minimal
    // here — they will be defined once we settle on the visual style.
    extend: {},
  },
  plugins: [],
};
