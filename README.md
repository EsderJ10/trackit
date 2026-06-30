# TrackIt

> An **offline-first, modular tracking platform** for mobile. The first module is a
> strength-training tracker with a real progression engine; the architecture is
> designed so that finance, habits, diet, and other trackers plug in by adding a
> folder and one registry line — without touching the core app.

**Stack:** Expo SDK 54 · React Native 0.81 · TypeScript (strict) · Expo SQLite +
Drizzle ORM · Zustand · NativeWind v4 · pnpm

---

## The Problem

Most tracking apps are vertical silos: a gym app knows nothing about a habit app,
and every new tracker re-implements the same plumbing — local persistence, an
auth gate, a settings screen, a dashboard. I wanted to find out whether you can
build that plumbing **once** as a stable core, and treat each tracker as a
hot-swappable module that the core knows nothing about.

That goal forced two harder constraints that shaped every decision:

- **Offline-first.** A tracking app is worthless if it stalls without signal. All
  state lives in on-device SQLite; there is no server in the loop. That makes
  *device loss = data loss*, which in turn made data export, schema migrations,
  and idempotent seeds first-class concerns rather than afterthoughts.
- **Genuinely extensible, not "extensible in a slide."** The easy version of
  modularity is a folder convention nobody enforces. The real test is whether the
  core can drive a dashboard, routing, settings, and a persistent UI bar for a
  module it never imports. The honest version of that claim is documented below,
  including where it's still only proven at N=1.

The gym module is the proving ground: it's the most demanding tracker I could
pick (periodized programs, autoregulation, personal-record math), so if the
architecture survives it, it can carry the lighter ones.

---

## What it does

A lifter can:

- Build **routines** or follow a **periodized program** (StrongLifts 5×5, PPL,
  5/3/1, RPE-based — seeded as templates).
- Run a **live workout**: log reps × weight × RPE per set, with the previous
  session's numbers shown inline, a rest timer that survives backgrounding, plate
  math, and warm-up suggestions.
- Get **reasoned next-session suggestions** from a progression engine that
  supports four schemes (linear, double-progression, percentage/training-max, and
  RPE autoregulation) — always *suggest-and-confirm*, never silent auto-apply.
- Review **history and analytics**: estimated-1RM and volume trends, per-muscle
  weekly volume against MEV/MAV/MRV landmarks, PR detection, a logging calendar.
- **Own their data**: a local PIN/biometric gate, kg/lb that *converts* (not just
  relabels), and full JSON + CSV export/restore.

The core shell around it — auth, settings, a dynamic dashboard, a profile screen
— is module-agnostic. Commenting the gym module out of one array removes it from
the dashboard, routing, and settings with no other change.

---

## The module contract

The whole architecture hangs on one interface, `TrackerModule`
([`src/core/types/module.ts`](src/core/types/module.ts)). A module is a single
object that *offers* capabilities; the core renders whatever a module provides and
ignores what it doesn't:

```ts
interface TrackerModule {
  meta: ModuleMeta;                    // id, name, icon, accent color, version
  DashboardWidget: ComponentType;      // compact summary on the home dashboard
  ModuleScreen?: ComponentType;        // generic route, OR…
  ownsRouteStack?: boolean;            // …a module brings its own nested nav
  SettingsPanel?: ComponentType;       // slotted into core Settings
  primaryTabs?: ModulePrimaryTab[];    // bottom tabs (gym → Train, History)
  ProfileWidget?: ComponentType;       // a section on the core Profile screen
  GlobalBar?: ComponentType;           // persistent bar (gym's "resume workout")
  seed?: (db) => Promise<void>;        // idempotent data seed, run every launch
}
```

The registry is the *only* place core code names a concrete module:

```ts
// src/core/module-registry.ts
export const MODULES: readonly TrackerModule[] = [gymModule];
```

Everything downstream — the dashboard grid, the `/modules/[moduleId]` route, the
settings sections, the persistent action bars — is a `.map()` over that array.
**Core never imports from a module** except this one barrel; modules may import
from core and the shared UI kit, never from each other. That single rule is what
keeps the platform from rotting into a ball of mud as modules multiply.

One caveat is that the database is **composed at build time**, not runtime. 
A module's Drizzle tables are merged via a schema barrel and require `pnpm db:generate` 
+ a rebuild — there is no runtime DDL. So "add a module in one line" is really *two* steps 
(registry array + schema barrel). The [roadmap](ROADMAP.md) tracks closing that DX gap instead of
overclaiming it.

---

## The Tools

| Tool | Role | Why |
| --- | --- | --- |
| **Expo (SDK 54) + Expo Router** | App runtime + file-based routing | Managed workflow and OTA-friendly; file routing keeps route files thin (they only import module screens). Pinned to SDK 54 to match Expo Go. |
| **TypeScript (strict, no `any`)** | Whole codebase | A modular contract is only safe if it's typed end-to-end. ESLint is type-aware to *enforce* no-`any` / no-floating-promises. |
| **Expo SQLite + Drizzle ORM** | Offline-first persistence | Real relational storage on-device with typed queries and versioned `.sql` migrations. Reactive reads via `useLiveQuery` keep the UI in sync without a cache layer. |
| **Zustand** | Ephemeral client state | Lightweight, no boilerplate. Used *only* for transient state (active workout session, rest timer) — DB-derived data is never duplicated into a store. |
| **NativeWind v4 (Tailwind)** | Styling + design tokens | Utility-first styling with a single source-of-truth palette shared by Tailwind and typed color APIs. |
| **Vitest** | Logic unit tests | Fast, runs the load-bearing pure logic (unit conversion, progression engine, PR math, backup serialization) in a CI-able form without a native harness. |
| **pnpm** | Package management | Strict, fast installs (`nodeLinker: hoisted` so Metro/Expo get a flat tree). |
| **Docker** | Reproducible APK builds | A dockerized offline builder produces an installable Android APK without the cloud build tier. |

---

## Challenges (and how I worked through them)

The [`ROADMAP.md`](ROADMAP.md) is the full engineering log — each milestone records
not just what shipped but the *trade-offs* and the "as built" reality. The
highlights:

### 1. Units that convert, not just relabel
The first version stored a weight and a unit label per row — so switching kg→lb
silently mislabeled a 100 kg lift as "100 lb." The fix was an architectural rule:
**store canonical kilograms in the DB, convert at the input/render boundary only.**
Every PR calculation and chart runs on canonical kg and converts at the last
moment. The conversion helpers are unit-tested, and the discipline ("canonical kg,
convert at render") became a constraint every later feature had to honor.

### 2. A progression engine that's correct under mutable state
The hardest domain problem. Strength progression isn't one formula — it's ~five
schemes of increasing sophistication (linear, double-progression, reps-sum,
percentage/training-max, RPE autoregulation). I researched how the leading apps
calculate "what to do next," then built a **pure, dependency-free engine**
(`progression-engine.ts`, `program-roadmap.ts`) with the messy edge cases encoded
as invariants rather than patched later:

- **Program-scoped history** — a freestyle set must never corrupt a program's
  success streak.
- **Loadable rounding** — every suggested weight rounds to an achievable plate/
  dumbbell increment; never `62.5237`. The *success* path is exact by construction
  (`start + n×increment`); only deloads round.
- **Idempotent advance** — mutable training state means "advance on finish" must
  fire *only* on the null→finished transition, skip sessions with zero completed
  sets (a skip isn't a failed attempt), and refuse a duplicate lift that would
  double-advance one state row.

The pure engine is covered by dedicated tests; the DB glue around it is kept
deliberately mechanical so the correctness lives in the tested layer.

### 3. Programs as a Days × Weeks roadmap — and a redesign
The first program implementation was a flat, single-day structure
indistinguishable from a routine. Rather than ship something hollow, I redesigned
it (migration `0006`) into a real periodized roadmap — Program → Weeks → Days →
Exercises → Sets — using **structured Drizzle tables, deliberately not a scriptable
text DSL**, to stay inside the offline-first model with no parser. A polymorphic
`program_sets.intensitySpec` (absolute kg | %TM | @RPE | AMRAP) lets one table
express every scheme and arbitrary periodization waves.

### 4. Offline-first means owning the failure modes
No server means device loss is total data loss, so the project treats it as a
real engineering surface: JSON backup/restore plus CSV export, idempotent seeds
that can grow and reach already-seeded devices, and 20 versioned migrations.
Restore deliberately **refuses a schema mismatch rather than corrupting data** —
the safe failure is the intentional one, and it's documented as a known limitation
rather than papered over.

### 5. Platform-specific friction, recorded so the next person doesn't pay twice
Pinning to Expo Go SDK 54 (Reanimated 4 needs `react-native-worklets`; Drizzle
`.sql` migrations need `babel-plugin-inline-import`; DB schema files must use
relative imports because drizzle-kit bundles with esbuild and ignores tsconfig
paths; nested reorderable lists can't nest). Each gotcha is captured in
[`CLAUDE.md`](CLAUDE.md).

---

## Getting started

```bash
pnpm install
make start          # then press a / i, or scan the QR with Expo Go (SDK 54)
```

A [`Makefile`](Makefile) wraps the common tasks (run `make` with no target for a
self-documenting list). Each target is a thin alias over the underlying `pnpm`
script, so either form works:

```bash
make typecheck      # tsc --noEmit (must be clean, no `any`)
make lint           # type-aware ESLint
make test           # Vitest (logic suites)
make check          # typecheck + lint + format + test, in one shot
make db-generate    # regenerate Drizzle migrations after a schema change
```

> Requires **Expo Go SDK 54** (the project is pinned to SDK 54). The New
> Architecture (Reanimated 4 + NativeWind) is enabled via `app.json`.

`make apk` produces an installable Android APK from a dockerized offline build —
no cloud build tier required:

```bash
make apk            # docker compose build + run → ./build-output/trackit.apk
make apk-clean      # remove the APK artifacts and the builder image
```

---

## Project structure

```
app/            # Expo Router — thin route files that only import module screens
src/core/       # module registry, DB (Drizzle), auth seam, settings, dashboard
src/ui/         # shared themed primitives (Screen, Card, Button, Text, Stat, …)
src/modules/    # self-contained tracking modules (gym is the first)
```

### Adding a module

1. Create `src/modules/<id>/` with a `schema.ts` and an `index.ts` exporting a
   `TrackerModule` (meta + `DashboardWidget`, plus any optional capabilities).
2. Add it to `MODULES` in `src/core/module-registry.ts` (one line).
3. Add `export * from '../../modules/<id>/schema'` to `src/core/db/schema.ts` and
   run `make db-generate` (`pnpm db:generate`).
4. (Optional) Add route files under `app/modules/<id>/` for richer navigation.

See [`CLAUDE.md`](CLAUDE.md) for conventions and SDK-54 gotchas, and
[`ROADMAP.md`](ROADMAP.md) for the full milestone-by-milestone engineering log.

---

## What I learned

- **A contract is only as strong as what it forbids.** "Core never imports a
  module" did more for the design than any amount of folder structure — the
  constraint is what makes the architecture provably modular instead of
  aspirationally modular.
- **Push correctness into pure functions.** The progression engine is the most
  complex logic in the app and also the most trusted, because it's pure and
  exhaustively tested. The DB glue stays dull on purpose.
- **Decide the invariants from the domain, not from the bug reports.** Scoping
  history to a program, idempotent advancement, loadable rounding, and
  canonical-unit storage were all designed *up front* from researching how the
  domain actually works — each would have been a painful retrofit.
- **Offline-first is a feature with a tax.** It buys instant, private, always-on
  UX, and it bills you for migrations, export, and seed idempotency. Naming that
  tax early made it manageable.
- **Document the gap between claim and reality.** The most valuable lines in the
  roadmap are the "as built" and "unverified at runtime" notes. Writing down where
  the work *isn't* finished is what makes the parts that are finished trustworthy.

---

## License

See [`LICENSE`](LICENSE).
