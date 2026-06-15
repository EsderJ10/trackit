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

**As built:**

- Backup excludes the `users` table on purpose: the credential lives in
  SecureStore, so restoring a stale profile onto a fresh install would block
  re-login. Tracking/preference data is not user-scoped, so it restores under
  whatever account exists on the device.
- Tests are **logic-only** (Vitest): unit conversion, formatters, and the backup
  serialize/parse+validate. Contract and DB-bound seams (seed idempotency, query
  helpers) need a native harness and are deferred — revisit if we adopt jest-expo.
- **Known limitation — restore is same-schema only.** A backup records its
  migration tag and restore rejects a mismatch (refuse, don't corrupt). This
  means a backup taken now won't restore on a future build that adds a migration
  — i.e. the device-loss-then-reinstall-latest path. Forward-migrating old
  backups is deferred; for now the safe failure is intentional.
- The restore IO and M1's `DROP COLUMN` migration are **unverified at runtime**
  (logic-only tests don't touch the DB write path) — confirm on a device.

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

**As built:**

- **No schema changes.** `set_logs.rpe` and `workout_sessions.notes` already
  existed (added with the gym schema); M3 only wired up write paths + display,
  so there is no migration and no rebuild required for this milestone.
- **Notes & RPE.** RPE is an inline per-set field (1–10, half-steps, clamped;
  blank clears it). Notes are a per-session multiline field on the active
  workout. Both surface read-only in a new **session-detail screen** reachable
  by tapping a row in History (the old History was a flat summary with no
  detail).
- **Progression view** has **both** entry points: a dedicated Exercises list in
  the gym module, and tap-an-exercise-name from the active-workout card and the
  session-detail screen. PRs are heaviest set + estimated 1RM (Epley); the math
  lives in `progression.ts` and is unit-tested. All PR math runs on canonical
  kg and converts at render (M1 discipline).
- **Rest timer** is the gym module's first Zustand store
  (`rest-timer-store.ts`). The default rest length is **in-memory only** (no
  persisted preference, by design — a stored default would mean a schema
  column/migration, out of scope for "polish"); the ±30s controls reshape the
  running timer. It stores an absolute `endsAt` so the countdown survives
  re-renders, and auto-starts when a set is checked off.
- **Unverified at runtime (logic-only gates can't see UI).** `tsc`/lint/tests
  pass, but the device behaviors are pending a real run: the rest-timer tick and
  auto-dismiss, the `SetRow` density now that it carries reps × weight + RPE +
  two touch targets on a narrow screen (the redundant inline ✕ was kept since
  swipe-to-delete already exists — a candidate to drop if it's too tight), and
  the multiline notes field. Confirm these on a device.

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

## M5 — Programs & progression · `feat/m5-programs-progression`

**Goal:** help the lifter decide _what to do next_, not just record what they
did. Today the app is a passive log (like Hevy/Strong): it seeds the next
session from last performance and leaves every load decision to the user. M5
adds an **opt-in, advisory progression engine** driven by the **program** the
user follows — the first piece of genuine training intelligence.

This is **gym-module depth**, not a core feature: progression is gym-domain, and
core never imports from a module. It lives entirely in `src/modules/gym/`.
"Core" in the original ask means _first-class_, not `src/core/`.

### Research that shaped this (the "how it's calculated" landscape)

Tracking apps split two ways: **passive/visualization** (Hevy, Strong — show
"previous," user decides) vs **active/algorithmic** (Liftosaur, Fitbod — compute
the next prescription from a rule). We are taking the active path, advisory-only.
The real calculation is one of ~5 schemes, increasing in sophistication:

- **Linear (LP)** — hit all target reps → add a fixed increment; miss N sessions
  in a row → deload (−10%). Novices (Starting Strength / StrongLifts).
- **Double progression (DP)** — work a rep range `[min,max]`; hit `max` on all
  sets → add weight, reset to `min`. Self-autoregulating. Intermediates.
- **Reps-sum** — total reps across sets over a threshold → add weight.
- **% / training-max (5/3/1, Texas Method)** — loads are a % of a **training
  max** (≈90 % of 1RM); multi-week waves; AMRAP last set; bump TM per cycle
  (+2.5 kg upper / +5 kg lower).
- **RPE / RIR autoregulation** — prescribe reps **@ RPE**; pick load from an
  RPE→%1RM table relative to e1RM (RPE 10≈100, 9≈96, 8≈92, 7≈86 %;
  `RIR = 10 − RPE`). Adjusts to daily readiness.

Decision (confirmed with product): support **all four schemes** (LP, DP,
percent, RPE), model a **multi-week periodized program** (not just per-lift
rules), and keep suggestions **suggest-and-confirm** (pre-fill + reason, user
accepts/overrides — never silent auto-apply).

### What the module already gives us

- `routine_exercises` carries per-lift targets (`targetSets/Reps/Weight`).
- `set_logs` stores **reps, weight, and RPE per set** — RPE autoregulation is in
  reach with no new capture.
- `progression.ts` already computes **e1RM (Epley)** + PRs, unit-tested on
  canonical kg.
- `workout_sessions.routineId` proves history can be scoped to a template; the
  engine scopes to **`programId`** for the same reason.

### Target data model (one migration + rebuild, done once)

Programs are a **new path parallel to routines** — routines stay untouched, so
not opting into a program leaves today's behavior byte-for-byte identical.

- **`programs`** — periodized container + cursor: `name`, `description`,
  `lengthWeeks`, `currentWeek`, `currentCycle`, `active`, `createdAt`.
- **`program_exercises`** — a lift's slot + how it progresses: `programId`,
  `dayIndex`, `exerciseId`, `position`, `schemeType`
  (`'lp' | 'dp' | 'percent' | 'rpe'`), `increment`, per-cycle TM bumps,
  `deloadPct`, `failThreshold`.
- **`program_sets`** — the **keystone**: per-week × per-set prescription
  (`programExerciseId`, `weekIndex`, `setNumber`, `reps`, `intensitySpec`).
  `intensitySpec` is polymorphic — absolute kg | %TM | @RPE | AMRAP — so one
  table expresses **every** scheme and arbitrary waves (LP/DP store a bare rep
  target; 5/3/1 stores `{reps, %TM, AMRAP}` per week; RPE stores `{reps, @RPE}`).
- **`exercise_training_state`** — the state that carries across cycles and lives
  in no set log: `trainingMaxKg` (percent schemes), `currentWeightKg` (lp/dp),
  `successStreak`, `failStreak`. Deciding this **now** avoids a second migration
  when percent/RPE land.
- **`workout_sessions` (+cols)** — `programId`, `programWeekIndex`,
  `programDayIndex`, all **nullable** (null = freestyle/routine, i.e. today).

### The engine (pure, dependency-free, unit-tested like `progression.ts`)

```
suggestNext(prescription, state, scopedHistory, unit)
   -> { sets: [{ reps, weightKg, reason, amrap? }] }
advance(prescription, state, loggedSets)
   -> nextState   // bump weight/TM, streaks, week/cycle cursor
```

Invariants baked in from the research (not afterthoughts):

- **Program-scoped history** (`programId`), never all-time — else a freestyle set
  or the same lift in another program corrupts the streak.
- **Loadable rounding** — every suggested kg rounds to an achievable increment
  for the user's unit/equipment (kg vs lb plates, fixed dumbbells); never a raw
  `62.5237`. (Liftosaur rounds for exactly this reason.)
- **Reasoned** — every suggestion carries a human reason ("+2.5 kg — hit all
  reps", "−10 % — missed 3 sessions", "Week 3: 1+ @ 95 % TM").
- **Suggest + confirm** — engine output pre-fills `SetRow`; the user accepts or
  overrides. Never silent.

### Build order (each phase ships something usable)

1. **Engine + LP/DP, state-based** — `programs` / `program_exercises` /
   `exercise_training_state` schema, the two simplest schemes, suggest+confirm
   wired into Start Workout. Validates the UX with the least machinery. (The
   research sketch derived progression from history; the build stores the
   working weight + streaks instead — deterministic and ready for the phase-2
   training max, at the cost of making advance-on-finish idempotency our job.)
2. **`program_sets` + percentage / 5-3-1** — the wave template, training-max
   input, the week/cycle cursor + deload week.
3. **RPE autoregulation** — RPE→%1RM table on top of e1RM (the per-set RPE data
   already exists).
4. **Polish** — program editor UI, deload reasons, plate/dumbbell rounding
   config.

**Done when:** a user can opt into a program, see reasoned next-session
suggestions they can accept or override, and have the program advance (weights,
training maxes, week/cycle cursor) automatically after each workout — across all
four schemes; routines and freestyle workouts are unchanged; the engine math is
unit-tested on canonical kg; `tsc`/lint/tests clean.

**As built — phase 1 (lp/dp):**

- **State-based, not derived-from-history.** Each program-exercise stores its
  working weight + rep target + success/fail streaks in `exercise_training_state`
  (keyed `(programId, exerciseId)` — one progression per lift). `suggestNext`
  renders the next sets from that state; `advance` folds a finished session back
  into it. Decision logic is pure and unit-tested in `progression-engine.ts`
  (lp + dp, 13 tests); the DB glue in `queries.ts` is mechanical.
- **Three correctness guards in the glue** (the tax for mutable state):
  `finishWorkout` advances **only** on the null→finished transition (no
  double-advance on re-finish); an exercise with **zero completed sets** this
  session is left untouched (a skip is not a failed attempt → no phantom
  deload); `addProgramExercise` refuses a **duplicate lift** in a program (it
  would share one state row and double-advance).
- **Rounding discipline.** The success path is `start + n×increment` (loadable by
  construction, never snapped); only the deload (`×0.9`) is rounded — so a non-2.5
  increment (microplates, the kg value of 5 lb) stays exact. Locked by a test.
- **Suggest + confirm.** Program sessions pre-fill sets from the suggestion and
  show the rationale (`lastReason`, e.g. "+2.5 kg — hit all reps") under each
  exercise; the user edits any set freely. Programs are a path **parallel** to
  routines — not opting in leaves the routine/freestyle flow byte-identical.
- **Unverified at runtime (logic-only gates can't see the DB write path or UI).**
  `tsc`/lint/tests pass, but migration `0005` and the entire program flow have
  never executed. Only the 13 pure-engine tests touch new logic;
  `startProgramWorkout`/`advanceProgram`/`finishWorkout` and all the new screens
  passed tsc + lint only. **Device check:** fresh launch (0005 applies clean) →
  create program → add one DP lift → set working weight → Start workout
  (suggested sets pre-fill at that weight, "Starting weight" shows) → complete
  all sets at the top of the range → Finish → Start again → **weight advanced,
  reason reads "+2.5 kg — cleared 12 reps."** Then a session with missed reps →
  confirm no advance, and an eventual deload after the fail threshold.
- **Not yet built (later M5 phases):** `program_sets` (per-week waves),
  percentage/training-max and RPE schemes, the week/cycle cursor advancing,
  multi-day programs, and per-param editing (increment / rep-range / sets are
  fixed at scheme defaults; only the working weight is editable in the UI).

**Redesign — programs as a Days × Weeks roadmap (supersedes the flat phase 1):**

The original phase 1 shipped a single-day, flat program that was indistinguishable
from a routine. Following Liftosaur's model (Program → Weeks → Days → Exercises →
Sets), programs were rebuilt as a periodized roadmap — **structured Drizzle
tables, deliberately not a Liftoscript-style text DSL** (no parser; stays inside
the offline-first model).

- **Schema (migration `0006`):** new `program_days` (the split) and
  `program_weeks` (the periodization, with `is_deload`); `program_sets` — the
  per-week × per-set prescription keystone (`abs` kg | `pct` of training max |
  `rpe`, + AMRAP); `program_exercises` now belongs to a **day**;
  `exercise_training_state` rekeyed to the **slot** (`program_exercise_id`), so a
  lift can appear on more than one day; `programs` gained a **cursor**
  (`current_day_index` + `current_week`/`current_cycle`) and `rounding_step_kg`.
  Migration verified end-to-end against SQLite (clean apply over `0005`, FK
  cascades, history-preserving program delete).
- **Engine (pure, unit-tested):** `advanceCursor` (day → week → cycle wrap);
  `renderPrescribedSet` (TM×% and e1RM×RPE rendering, loadable-rounded);
  `rpePct` (Epley-consistent RPE→%1RM). 28 engine tests.
- **All four schemes:** lp/dp advance per session; **percent** bumps the training
  max at **cycle wrap** (independent of the deload-week skip — week 4 is a deload
  yet the cycle still bumps); **rpe** re-anchors the estimated 1RM from the best
  logged set. Start-workout renders the cursor's week+day; finish advances state
  then the cursor.
- **UI:** hierarchical editor (days → scheme-aware exercise rows editing the
  right anchor: working weight / training max / e1RM); program list shows the
  cursor ("Week 2 of 4 · Next: Pull (2/4)"); active workout scopes to the
  session's day.
- **Templates (seeded, idempotent):** StrongLifts 5×5 (lp, A/B), Push/Pull/Legs
  (dp), 5/3/1 (percent, 4 weeks + deload, per-cycle TM bump), RPE Strength (rpe).
- **Still deferred:** in-editor authoring of percentage/RPE **waves** and
  week/deload management (templates deliver these today; the editor authors
  lp/dp + multi-day and adjusts every scheme's anchor). Device runtime check of
  the full create → start → finish → advance loop still pending (logic, schema
  dry-run, and rendering are verified; the live DB write path is not).

---

## Out of scope (deferred, by design)

At-rest DB encryption (SQLCipher), cloud accounts/sync, and stronger password
KDFs are cloud-tier concerns left as typed seams. The local password + PIN are
app-layer gates — they do **not** encrypt the on-device database. M1 documents
that honestly rather than building encryption.
