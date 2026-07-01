import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// The `@/` alias mirrors tsconfig so source imports resolve the same way they
// do in the app.
const atAlias = { find: /^@\//, replacement: `${resolve(__dirname, 'src')}/` };

// Two Vitest projects, both headless (Node):
//   • unit        — pure logic, no native modules (the original suite).
//   • integration — the DB/migration layer. The app's real client and the real
//                    `drizzle-orm/expo-sqlite` driver run unchanged; only Expo's
//                    native `expo-sqlite` is aliased to a better-sqlite3-backed
//                    shim (with the real migrations applied). So every
//                    `queries/*.ts` module exercises the exact shipping code
//                    path off-device.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
        resolve: { alias: [atAlias] },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.itest.ts'],
          // drizzle-orm/expo-sqlite lives in node_modules and is externalized by
          // default, so its `require('expo-sqlite')` would bypass the alias below
          // and load the real native package (which can't run in Node). Inlining
          // it routes that import through Vite's resolver → our shim.
          server: { deps: { inline: [/drizzle-orm/] } },
        },
        resolve: {
          alias: [
            {
              find: 'expo-sqlite',
              replacement: resolve(
                __dirname,
                'tests/integration/support/expo-sqlite-shim.ts',
              ),
            },
            atAlias,
          ],
        },
      },
    ],
  },
});
