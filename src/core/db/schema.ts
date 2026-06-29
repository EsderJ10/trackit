/**
 * Global schema barrel — single source of truth for drizzle-kit. Modules are
 * composed here at BUILD time: add one `export *` line + run `pnpm db:generate`.
 * Use RELATIVE imports (not `@/`) — drizzle-kit bundles this with esbuild, which
 * ignores tsconfig path aliases.
 */
export * from '../auth/schema';
export * from '../settings/schema';
export * from '../../modules/gym/schema';
