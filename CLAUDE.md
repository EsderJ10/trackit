# CLAUDE.md

Guidance for AI agents and developers working in this repository.

> **Expo SDK 56** (React 19.2, React Native 0.85). Expo APIs change between SDKs — see `@AGENTS.md` and the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing Expo-specific code.

## Project

**TrackIt** — a mobile-first, **offline-first** tracking app. The defining requirement is an **extensible, modular architecture**: the gym workout tracker is the first of many independent tracking modules (finance, habits, diet, …). New modules must plug in by adding a `src/modules/<id>/` folder and **one line** in the module registry — the core app (auth, settings, dynamic dashboard) stays untouched.

## Hard Constraints (do not violate)

- **Package manager: pnpm ONLY.** Never use `npm` or `yarn`. All installs/scripts go through `pnpm`. Requires `nodeLinker: hoisted` in `pnpm-workspace.yaml` (pnpm v11 ignores the legacy `.npmrc` `node-linker` key) so Expo/Metro get a flat `node_modules`.
- **Navigation: Expo Router** (file-based routing). Route files in `app/` are thin — they import screen components from modules; they do not contain feature logic.
- **Language: TypeScript, strict mode. No `any`.** Use precise types, generics, and `unknown` + narrowing where needed.
- **State: lightweight only.** Prefer **Zustand** and React **Context**. No Redux or other heavy state libraries.
- **Components: functional only.** No class components.
- **UI: highly modular, reusable components.** Shared primitives live in `src/ui/`; build screens by composing them.

## Stack

- **Expo** (managed) + **Expo Router**
- **TypeScript** (strict)
- **NativeWind v4** (Tailwind CSS) for styling — design tokens in `tailwind.config.js`
- **Expo SQLite + Drizzle ORM** for local persistence (offline-first)
- **Zustand** for client state; **Context** for theme only

## Architecture Rules

- **Module contract**: every module exports a `TrackerModule` object (see `src/core/types/module.ts`) — `meta`, `schema`, `DashboardWidget`, `ModuleScreen`, optional `SettingsPanel` and `seed`. No `routes` field (Expo Router owns routing).
- **Registry**: add a module by importing it into `MODULES` in `src/core/module-registry.ts`. The dashboard and `/modules/[moduleId]` are driven entirely by this array.
- **Database is composed at BUILD time**: each module exports a Drizzle schema; `src/core/db/schema.ts` is a barrel that merges them for `drizzle-kit`. There is **no runtime DDL** — adding a module's tables requires `pnpm drizzle-kit generate` + a rebuild. Keep this boundary honest; don't imply runtime table creation.
- **No DB data duplicated into stores**: read DB-derived data with Drizzle `useLiveQuery`; use Zustand for ephemeral/client state (e.g. active workout session) only.
- **Core never imports from a specific module** (except the single registry barrel). Modules may import from `src/core` and `src/ui`, never from each other.
- **Auth is a seam**: v1 is a local PIN/biometric gate behind `auth-provider`. Keep it abstracted so a cloud provider can swap in without refactoring features.

## Layout (high level)

```
app/            # Expo Router — thin route files only
src/core/       # module registry, db, auth, settings, types
src/ui/         # shared reusable primitives + theme tokens
src/modules/    # self-contained tracking modules (gym, …)
```

## Conventions

- Path aliases: `@/core`, `@/modules`, `@/ui` (configured in `tsconfig.json`).
- Keep module code self-contained inside its folder (schema, store, queries, widgets, screens, components).
- Prefer composition and small, typed components over large files.
- Units (kg/lb), theme, and other cross-cutting preferences live in **core settings**, not per-row in module tables.

## Styling

- **Dark purple framework** (Liftosaur-inspired) — deliberately not pitch black; lifted surfaces + soft glowing accents. Clean, high-contrast, spacious tap targets (readable mid-workout).
- **Palette single source of truth**: `src/ui/tokens.js` (plain CJS so `tailwind.config.js` can `require` it). Consumed by both Tailwind (className colors) and `src/ui/theme.ts` (typed colors for raw-color APIs).
- **Semantic color names** (use these, not raw hex): `bg`, `surface[/alt/hi]`, `border[/soft]`, `primary[/bright/soft/glow]`, `fg[/muted/faint]`, `success`, `danger`, `warning`.
- **Per-module accents**: the core stays purple; each module sets its own accent via `ModuleMeta.color` (Gym = purple, Finance = green, Habits = teal) and applies it via inline `style`/props, not className.
- **Shared primitives** live in `src/ui/` — `Screen`, `Text` (variants), `Card`, `Button`, `Stat`, `EmptyState`, `Icon`. Compose screens from these; import from `@/ui`.
- **Icons**: `lucide-react-native` via the `Icon` wrapper (`<Icon icon={Dumbbell} />`). `ModuleMeta.icon` is a `LucideIcon` component.
- **Typography**: system fonts only for now (custom fonts deferred).
- `glow(color?, opacity?)` from `@/ui` returns the soft-glow shadow style for interactive/primary elements.

## Expo SDK 56 gotchas (learned)

- **Expo Router 56 moved off `@react-navigation/native`** to `standard-navigation`. Import `ThemeProvider`, `DarkTheme`, `useTheme` from `expo-router`, NOT `@react-navigation/native` (not installed).
- **Reanimated/worklets babel plugin** is added automatically by `babel-preset-expo` — do not add it manually.
- **Drizzle `.sql` migrations** require `babel-plugin-inline-import` (`['inline-import', { extensions: ['.sql'] }]`) plus `sql` in Metro `resolver.sourceExts`.
- **DB schema files use RELATIVE imports** (not `@/` aliases) because drizzle-kit bundles them with esbuild, which ignores tsconfig paths.

## Git

- Make **atomic commits** — one logical, related change per commit.
- Commit messages: **short, conventional-commit style**, e.g. `feat: auth sessions`, `chore: bootstrap expo app`, `feat: gym schema`.
- **Do not** add co-author/attribution trailers or any AI self-reference to commit messages.

## Common Commands

- `pnpm start` — start the Expo dev server
- `pnpm drizzle-kit generate` — regenerate migrations after schema changes
- `pnpm tsc --noEmit` — type-check (must pass with zero `any`)

## Scope Discipline

v1 ships the **core shell + the gym module only**. Cloud sync, cloud accounts, and other modules are deferred — leave typed seams, don't build them.
