/**
 * node:sqlite dry-run for the SESSION-LABEL read path — the "Freestyle" fix.
 *
 * The bug: program sessions render as "Freestyle" because the label queries only
 * LEFT JOIN `routines`, never `programs`/`program_days`. The fix adds those joins.
 * This is a READ-path change the pure `sessionLabel` test can't reach (it doesn't
 * exercise SQL), so — exactly like `wave-dryrun.mts` — we apply the REAL migrations
 * (0000…0012) to in-memory SQLite, insert the three session kinds, run the ACTUAL
 * join SQL from `useFinishedSessions`, feed each row through the REAL `sessionLabel`
 * pure fn, and assert the labels. Proves the join resolves program provenance.
 *
 * Run:  node scripts/session-label-dryrun.mts   (Node ≥22.18 / 24 strips the types)
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type SessionLabelFields,
  sessionLabelLine,
} from '../src/modules/gym/session-label.ts';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'src', 'core', 'db', 'migrations');

const db = new DatabaseSync(':memory:');

// --- 1) Apply the real migrations in journal order -------------------------
const journal = JSON.parse(
  readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
) as { entries: { tag: string }[] };
for (const entry of journal.entries) {
  db.exec(readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8'));
}

function run(sql: string, ...params: (string | number | null)[]): number {
  return Number(db.prepare(sql).run(...params).lastInsertRowid);
}
function all<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

const failures: string[] = [];
function assert(cond: boolean, msg: string): void {
  if (!cond) failures.push(msg);
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`);
}

const FINISHED = Date.UTC(2026, 5, 22);

// --- 2) Seed a program (6 weeks, "Push" day) + a routine -------------------
const programId = run(
  `INSERT INTO programs (name, length_weeks) VALUES (?, 6)`,
  '5-Day PPLUL',
);
const dayId = run(
  `INSERT INTO program_days (program_id, day_index, name) VALUES (?, 0, ?)`,
  programId,
  'Push',
);
const routineId = run(`INSERT INTO routines (name) VALUES (?)`, 'Upper A');

// --- 3) Three finished sessions: program, routine, ad-hoc ------------------
run(
  `INSERT INTO workout_sessions (program_id, program_week_index, program_day_index, program_day_id, finished_at)
   VALUES (?, 2, 0, ?, ?)`,
  programId,
  dayId,
  FINISHED + 3, // newest
);
run(
  `INSERT INTO workout_sessions (routine_id, finished_at) VALUES (?, ?)`,
  routineId,
  FINISHED + 2,
);
run(
  `INSERT INTO workout_sessions (finished_at) VALUES (?)`,
  FINISHED + 1, // oldest — pure ad-hoc, all provenance null
);

// --- 4) The EXACT join from useFinishedSessions ----------------------------
const rows = all<SessionLabelFields & { id: number; finishedAt: number }>(
  `SELECT ws.id                   AS id,
          r.name                  AS routineName,
          p.name                  AS programName,
          pd.name                 AS programDayName,
          ws.program_week_index   AS programWeekIndex,
          p.length_weeks          AS programLengthWeeks,
          ws.finished_at          AS finishedAt
   FROM workout_sessions ws
   LEFT JOIN routines r      ON ws.routine_id     = r.id
   LEFT JOIN programs p      ON ws.program_id     = p.id
   LEFT JOIN program_days pd ON ws.program_day_id = pd.id
   WHERE ws.finished_at IS NOT NULL
   ORDER BY ws.finished_at DESC`,
);

assert(
  rows.length === 3,
  `three finished sessions returned (got ${rows.length})`,
);

const labels = rows.map(sessionLabelLine);
assert(
  labels[0] === 'Push · Week 2 of 6',
  `program session labels by day + week — got "${labels[0]}" (was the "Freestyle" bug)`,
);
assert(
  labels[1] === 'Upper A',
  `routine session keeps its name — got "${labels[1]}"`,
);
assert(
  labels[2] === 'Freestyle',
  `ad-hoc session stays "Freestyle" — got "${labels[2]}"`,
);

// --- summary ---------------------------------------------------------------
console.log(
  '\n' +
    (failures.length === 0
      ? '✅ session-label join OK'
      : `❌ ${failures.length} failure(s)`),
);
if (failures.length > 0) {
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
