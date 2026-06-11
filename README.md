# TrackIt

A mobile-first, **offline-first** tracking app built around an **extensible module
architecture**. The first module is a **gym workout tracker**; future modules
(finance, habits, diet…) plug in by adding a folder + one registry line, with the
core app (auth, settings, dynamic dashboard) untouched.

## Stack

- **Expo SDK 54** + **Expo Router** (file-based routing) — pinned to match Expo Go SDK 54
- **TypeScript** (strict, no `any`)
- **NativeWind v4** (Tailwind) — dark purple theme
- **Expo SQLite + Drizzle ORM** (local, reactive `useLiveQuery`)
- **Zustand** for ephemeral state; **Lucide** icons
- **pnpm** only (requires `nodeLinker: hoisted` in `pnpm-workspace.yaml`)

## Getting started

```bash
pnpm install
pnpm start          # then press a / i, or scan the QR with Expo Go
```

Useful scripts:

```bash
pnpm typecheck      # tsc --noEmit (must be clean)
pnpm db:generate    # regenerate Drizzle migrations after a schema change
```

> Requires **Expo Go SDK 54** (the project is pinned to SDK 54). The New
> Architecture (Reanimated 4 + NativeWind) is enabled via `app.json`.

## Status

Code-complete and verified at the **compile/bundle level**: `pnpm typecheck`,
`expo export`, and `expo-doctor` (21/21) all pass. It has **not yet been run on a
device/emulator** (none was available in the build environment), so the runtime
checks below are the recommended first manual pass.

## Manual test checklist (first device run)

1. **Fresh install** launches past the splash; migrations apply with no error and
   the exercise picker is populated (catalog seed ran).
2. **Registry-driven dashboard**: the Gym widget appears on the dashboard purely
   from the module registry. Commenting `gymModule` out of
   `src/core/module-registry.ts` removes it with no other change.
3. **Gym flow**: Dashboard → tap Gym → `New routine` → add exercises/targets →
   `Start workout` → log sets (reps/weight) → `Finish` → see it in History and
   reflected in the dashboard widget. Reload the app → data persists.
4. **FK cascade**: deleting a routine clears its exercises; deleting a session
   removes its set logs (weekly volume drops accordingly).
5. **App lock**: Settings → enable app lock → set a PIN → background & reopen →
   lock screen → PIN/biometric unlocks.
6. **Units**: Settings → toggle kg/lb → set logger and widget reflect the unit.

## Architecture

- `app/` — thin Expo Router route files only.
- `src/core/` — module registry, DB (Drizzle), auth seam, settings, dashboard.
- `src/ui/` — shared themed primitives (`Screen`, `Card`, `Button`, `Text`, …).
- `src/modules/<id>/` — self-contained tracking modules (schema, queries,
  widget, screens, components).

### Adding a module

1. Create `src/modules/<id>/` with a `schema.ts` and an `index.ts` exporting a
   `TrackerModule` (meta + `DashboardWidget`, optional `ModuleScreen`/`seed`).
2. Add it to `MODULES` in `src/core/module-registry.ts` (one line).
3. Add `export * from '../../modules/<id>/schema'` to `src/core/db/schema.ts`
   and run `pnpm db:generate`.
4. (Optional) Add route files under `app/modules/<id>/` for richer navigation.

See `CLAUDE.md` for conventions and SDK-56 gotchas.
