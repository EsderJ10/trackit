/**
 * node:sqlite dry-run for the program WAVE path — the DB write paths that the
 * pure unit tests can't reach (the query functions are `@/core/db/client`-bound).
 *
 * It applies the REAL migrations (0000…0012) to an in-memory SQLite db, then
 * replicates the SQL of `generateProgramWave` → `startProgramWorkout`'s render →
 * `advanceProgram`'s rpe re-anchor, driving them with the REAL pure functions
 * imported from `progression-engine.ts`. The headline assertion is the bug the
 * advisor caught: logging a generated wave at its prescription (no typed RPE)
 * must leave the e1RM anchor FLAT — and the old fixed-target re-anchor must drift.
 *
 * Run:  node scripts/wave-dryrun.ts      (Node ≥22.18 / 24 strips the types)
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  e1rmFromLoggedSet,
  generateWave,
  renderPrescribedSet,
  rpePct,
} from '../src/modules/gym/progression-engine.ts';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'src', 'core', 'db', 'migrations');

const db = new DatabaseSync(':memory:');

// --- 1) Apply the real migrations in journal order -------------------------
// The drizzle `--> statement-breakpoint` markers begin with `--`, so they're SQL
// comments; each file can be exec'd whole.
const journal = JSON.parse(
  readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
) as { entries: { tag: string }[] };
for (const entry of journal.entries) {
  db.exec(readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8'));
}

// Sanity: 0012's new columns exist.
const setLogCols = (
  db.prepare(`PRAGMA table_info(set_logs)`).all() as { name: string }[]
).map((c) => c.name);
for (const col of ['set_type', 'duration_sec', 'distance_m']) {
  if (!setLogCols.includes(col)) throw new Error(`0012 missing column ${col}`);
}

// --- helpers ---------------------------------------------------------------
function run(sql: string, ...params: (string | number | null)[]): number {
  return Number(db.prepare(sql).run(...params).lastInsertRowid);
}
function all<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}
function one<T>(sql: string, ...params: (string | number | null)[]): T {
  return db.prepare(sql).get(...params) as T;
}

const failures: string[] = [];
function assert(cond: boolean, msg: string): void {
  if (!cond) failures.push(msg);
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
}
function approx(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

// --- 2) Seed a program with one RPE exercise + an e1RM anchor --------------
const STEP = 0.5; // tight rounding so the flat-anchor tolerance can be tight
const ANCHOR0 = 100; // starting estimated 1RM (kg)
const TARGET_RPE = 8;
const REPS = 5;

const programId = run(`INSERT INTO programs (name) VALUES (?)`, 'Dry-run');
db.prepare(`UPDATE programs SET rounding_step_kg = ? WHERE id = ?`).run(
  STEP,
  programId,
);
const dayId = run(
  `INSERT INTO program_days (program_id, day_index, name) VALUES (?, 0, ?)`,
  programId,
  'Day 1',
);
const exId = run(
  `INSERT INTO exercises (name, muscle_group) VALUES (?, ?)`,
  'Bench Press (Barbell)',
  'Chest',
);
const slotId = run(
  `INSERT INTO program_exercises
     (program_id, program_day_id, exercise_id, position, scheme_type, target_sets, target_rpe)
   VALUES (?, ?, ?, 0, 'rpe', 3, ?)`,
  programId,
  dayId,
  exId,
  TARGET_RPE,
);
run(
  `INSERT INTO exercise_training_state
     (program_exercise_id, current_weight_kg, current_reps, e1rm_kg, last_reason)
   VALUES (?, 0, ?, ?, 'Starting weight')`,
  slotId,
  REPS,
  ANCHOR0,
);

// --- 3) generateProgramWave replica: pure generateWave → program_sets/weeks --
const rules = {
  weekCount: 4,
  setsStart: 3,
  setsEnd: 3,
  reps: REPS,
  rirStart: 3, // week 1 → RPE 7
  rirEnd: 0, // week 4 → RPE 10
  amrapLastSet: false,
  deload: { sets: 2, reps: REPS, rir: 4 },
};
const cells = generateWave(rules);
const totalWeeks = rules.weekCount + 1;
for (let w = 1; w <= totalWeeks; w++) {
  run(
    `INSERT INTO program_weeks (program_id, week_index, name, is_deload) VALUES (?, ?, ?, ?)`,
    programId,
    w,
    `Week ${w}`,
    w === rules.weekCount + 1 ? 1 : 0,
  );
}
for (const c of cells) {
  run(
    `INSERT INTO program_sets
       (program_exercise_id, week_index, set_number, reps, intensity_kind, intensity_value, amrap)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    slotId,
    c.weekIndex,
    c.setNumber,
    c.reps,
    c.intensityKind,
    c.intensityValue,
    c.amrap ? 1 : 0,
  );
}
const weekRpe = (w: number): number =>
  one<{ v: number }>(
    `SELECT intensity_value AS v FROM program_sets WHERE program_exercise_id = ? AND week_index = ? LIMIT 1`,
    slotId,
    w,
  ).v;
assert(weekRpe(1) === 7, `wave week 1 prescribes RPE 7 (got ${weekRpe(1)})`);
assert(weekRpe(4) === 10, `wave week 4 prescribes RPE 10 (got ${weekRpe(4)})`);

// --- one session through render → log → re-anchor for a given week ----------
// Returns { newAnchor, oldAnchor } — NEW uses the per-week prescribed RPE, OLD
// uses the fixed target (the bug). Logs the prescribed weights with rpe = NULL
// (the common pre-fill path), exactly as the app does.
function runWeek(
  weekIndex: number,
  anchorIn: number,
): { neu: number; alt: number } {
  const sessionId = run(
    `INSERT INTO workout_sessions (program_id, program_week_index, program_day_index, program_day_id)
     VALUES (?, ?, 0, ?)`,
    programId,
    weekIndex,
    dayId,
  );

  // startProgramWorkout: render this week's prescriptions off the anchor.
  const prescribed = all<{
    set_number: number;
    reps: number;
    intensity_kind: 'abs' | 'pct' | 'rpe';
    intensity_value: number;
    amrap: number;
  }>(
    `SELECT set_number, reps, intensity_kind, intensity_value, amrap
     FROM program_sets WHERE program_exercise_id = ? AND week_index = ? ORDER BY set_number`,
    slotId,
    weekIndex,
  );
  for (const p of prescribed) {
    const rendered = renderPrescribedSet(
      {
        reps: p.reps,
        intensityKind: p.intensity_kind,
        intensityValue: p.intensity_value,
        amrap: p.amrap === 1,
      },
      {
        currentWeightKg: 0,
        trainingMaxKg: null,
        e1rmKg: anchorIn,
        stepKg: STEP,
      },
    );
    run(
      `INSERT INTO set_logs
         (session_id, exercise_id, set_number, reps, weight, rpe, set_type, completed_at)
       VALUES (?, ?, ?, ?, ?, NULL, 'working', ?)`,
      sessionId,
      exId,
      p.set_number,
      rendered.reps,
      rendered.weightKg,
      Date.UTC(2026, 5, 22),
    );
  }

  // advanceProgram rpe branch: working sets only, re-anchor at the rendered RPE.
  const logged = all<{
    set_number: number;
    reps: number;
    weight: number;
    rpe: number | null;
  }>(
    `SELECT set_number, reps, weight, rpe FROM set_logs
     WHERE session_id = ? AND exercise_id = ? AND set_type = 'working' AND completed_at IS NOT NULL
     ORDER BY set_number`,
    sessionId,
    exId,
  );
  const presMap = new Map<number, number>();
  for (const p of all<{ set_number: number; intensity_value: number }>(
    `SELECT set_number, intensity_value FROM program_sets
     WHERE program_exercise_id = ? AND week_index = ? AND intensity_kind = 'rpe'`,
    slotId,
    weekIndex,
  )) {
    presMap.set(p.set_number, p.intensity_value);
  }
  const neu = Math.max(
    ...logged.map((s) =>
      e1rmFromLoggedSet(
        s.weight,
        s.reps,
        s.rpe ?? presMap.get(s.set_number) ?? TARGET_RPE,
      ),
    ),
  );
  // The OLD (buggy) path: re-anchor every set at the single target RPE.
  const alt = Math.max(
    ...logged.map((s) =>
      e1rmFromLoggedSet(s.weight, s.reps, s.rpe ?? TARGET_RPE),
    ),
  );
  return { neu, alt };
}

// --- 4) The headline invariant: anchor stays FLAT across every week ---------
// Tolerance covers the render's 0.5 kg rounding (≈ step / rpePct).
const tol = STEP / rpePct(7, REPS) + 1e-6;
let anchorDrifted = false;
for (let w = 1; w <= rules.weekCount; w++) {
  const { neu, alt } = runWeek(w, ANCHOR0);
  assert(
    approx(neu, ANCHOR0, tol),
    `week ${w} (RPE ${weekRpe(w)}): NEW re-anchor stays flat — ${neu.toFixed(2)} ≈ ${ANCHOR0}`,
  );
  // Discriminating check: the OLD path must drift on any week whose RPE ≠ target.
  if (weekRpe(w) !== TARGET_RPE && !approx(alt, ANCHOR0, tol))
    anchorDrifted = true;
}
assert(
  anchorDrifted,
  'OLD fixed-target re-anchor DRIFTS on off-target weeks (proves the harness discriminates)',
);

// --- 5) Beating the prescription raises the anchor -------------------------
// Re-log week 1's top set with one extra rep at the same load → e1RM should rise.
{
  const w = 1;
  const render = renderPrescribedSet(
    {
      reps: REPS,
      intensityKind: 'rpe',
      intensityValue: weekRpe(w),
      amrap: false,
    },
    { currentWeightKg: 0, trainingMaxKg: null, e1rmKg: ANCHOR0, stepKg: STEP },
  );
  const beat = e1rmFromLoggedSet(render.weightKg, REPS + 1, weekRpe(w));
  assert(
    beat > ANCHOR0,
    `beating the prescription (+1 rep) raises the anchor — ${beat.toFixed(2)} > ${ANCHOR0}`,
  );
}

// --- summary ---------------------------------------------------------------
console.log(
  '\n' +
    (failures.length === 0
      ? '✅ wave path OK'
      : `❌ ${failures.length} failure(s)`),
);
if (failures.length > 0) {
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
