import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// Logic-only tests (no React Native / native modules). The `@/` alias mirrors
// tsconfig so source imports resolve the same way they do in the app.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: [{ find: /^@\//, replacement: `${resolve(__dirname, 'src')}/` }],
  },
});
