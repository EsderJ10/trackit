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
