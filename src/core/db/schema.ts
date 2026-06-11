/**
 * Global schema barrel — the single source of truth for drizzle-kit.
 *
 * Each tracking module owns a slice of the database and exports its Drizzle
 * tables; they are composed here at BUILD time. Adding a module = add one
 * `export * from '<module>/schema'` line below and run `pnpm db:generate`.
 *
 * NOTE: use RELATIVE imports here (not the `@/` alias) — drizzle-kit bundles
 * this file with esbuild, which does not resolve tsconfig path aliases.
 */
export * from '../settings/schema';
// export * from '../../modules/gym/schema'; // added when the gym module lands
