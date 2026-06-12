# TrackIt — Roadmap

The path from "core shell + gym works" to "a validated, trustworthy modular
tracking platform." Milestones are ordered: each one assumes the previous has
landed. **One branch per milestone** (branch names below); commits within a
milestone stay atomic per the repo convention.

Current state (2026-06): the core shell, auth seams, and the gym module are
built and `tsc` passes clean. Three things are _half-built_ (stored-but-unused
or mislabeled), there is no test/lint/export infrastructure, and the central
architectural promise — "add a module in one line" — has only ever been
exercised by a single module.

---

## M1 — Correct the half-built · `feat/m1-correct-half-built`

**Goal:** ship a v1 where every surfaced feature is actually correct. These are
doc-vs-reality gaps, not new features.

- **Weight units convert, not just relabel.** Decision: **store canonical kg**
  in the DB; convert to/from the user's display unit at input and render. A
  100 kg lift must stay 100 kg when the user switches to lb (it displays as
  ~220 lb), instead of being silently mislabeled "100 lb." Add conversion
  helpers in core (unit is a core setting), apply them at every weight
  input/display in the gym module.
- **Remove the theme dead code.** The `theme` column + `setThemePreference()`
  have zero callers and the app is intentionally dark-purple. Drop the column
  (migration), the setter, and the `ThemePreference` type.
- **Warn that there is no account recovery.** Forgetting the local password
  locks the user out with no reset (recovery means wiping app data = losing all
  history). Add a clear one-line warning on the registration screen.

**Done when:** switching units re-renders all history correctly; no dead theme
symbols remain; registration states the no-recovery caveat; `tsc` clean.

---

## M2 — Foundation hygiene · `feat/m2-foundation-hygiene`

**Goal:** make the platform safe to grow. Offline-first means device loss =
total data loss, and a contract many modules depend on needs regression cover.

- **Data export / backup.** Export the full SQLite dataset to a shareable
  JSON (and import/restore). Justified by the offline-first thesis, not
  gold-plating — it's the mitigation for the scariest failure mode.
- **Test scaffolding.** Cover the load-bearing seams: the unit-conversion
  helpers (M1), seed idempotency, the module contract, and the gym query
  helpers. Pick a runner that fits Expo/RN.
- **Lint + format config.** ESLint + Prettier with the repo's existing
  conventions encoded, so module #2 onward stays consistent.

**Done when:** a user can export and restore their data; core seams have tests
that run in CI-able form; `lint` passes.

---

## M3 — Gym depth (polish) · `feat/m3-gym-depth`

**Goal:** make the one shipped module genuinely sticky before adding more.

- **Surface notes & RPE.** Both columns exist (`set_logs.rpe`,
  `workout_sessions.notes`) but are never shown or edited. Wire them into the
  active-workout and history UI.
- **Progression / PR view.** `getLastPerformance` already lays the groundwork —
  build a per-exercise history + personal-record view.
- **Rest timer.** A between-sets timer during the active workout.

**Done when:** notes/RPE are editable and visible; each exercise has a
progression view with PRs; the active workout has a rest timer.

---

## M4 — Validate extensibility (v2) · `feat/m4-second-module`

**Goal:** prove the architecture's reason for existing. The "one line to add a
module" claim is untested at N=1, and the registry's own comment already admits
it's really _two_ steps (registry array **and** schema barrel + `db:generate` +
rebuild). A second, differently-shaped module is the only real test.

- **Build module #2** (e.g. Habits or Finance) — ideally one that exercises the
  _generic_ `ModuleScreen` route and a `SettingsPanel`, paths the gym module
  doesn't use.
- **Close the DX gap** the second module exposes; reconcile the "one line"
  claim with reality (either make it true or correct the docs).
- **Introduce `userId` scoping** — already a documented seam in the `users`
  schema — as the foundation for eventual multi-user/sync.

**Done when:** a second module ships by touching only its own folder + the
registry/barrel; any friction found is fixed or documented; data is scoped to a
user id.

> **Scope note:** M4 is the v2 milestone. CLAUDE.md's Scope Discipline ships v1
> as core shell + gym only. M1–M3 harden v1; M4 opens v2.

---

## Out of scope (deferred, by design)

At-rest DB encryption (SQLCipher), cloud accounts/sync, and stronger password
KDFs are cloud-tier concerns left as typed seams. The local password + PIN are
app-layer gates — they do **not** encrypt the on-device database. M1 documents
that honestly rather than building encryption.
