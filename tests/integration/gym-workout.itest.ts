import { db } from '@/core/db/client';
import { seedGym } from '@/modules/gym/seed';
import {
  addSet,
  deleteSession,
  finishWorkout,
  getActiveSession,
  setSetCompleted,
  startWorkout,
} from '@/modules/gym/queries/sessions';
import { beforeEach, describe, expect, it } from 'vitest';

import { rawSqlite, resetTestDb } from './support/expo-sqlite-shim';

/**
 * End-to-end exercise of the gym module's SQLite path — seeding, an active
 * workout lifecycle, and delete cascade — all against a real engine. This is
 * the blind spot the pure-logic unit tests can't reach: the `queries/*.ts`
 * modules import the `db` singleton and run actual SQL, so bugs in a query,
 * a constraint, or a migration surface here instead of on a device.
 *
 * Only Expo's native `expo-sqlite` is aliased to a better-sqlite3 shim (see
 * `vitest.config.ts`); the app's real client, driver, and query modules run
 * unchanged — so `db` here is the exact shipping singleton.
 */
describe('gym workout lifecycle (real SQLite)', () => {
  beforeEach(() => {
    resetTestDb();
    seedGym(db);
  });

  function firstExerciseId(): number {
    const row = rawSqlite()
      .prepare('SELECT id FROM exercises ORDER BY id LIMIT 1')
      .get() as { id: number } | undefined;
    expect(row, 'seedGym should populate the exercises table').toBeDefined();
    return row!.id;
  }

  it('seeds a non-empty exercise library', () => {
    const { count } = rawSqlite()
      .prepare('SELECT COUNT(*) AS count FROM exercises')
      .get() as {
      count: number;
    };
    expect(count).toBeGreaterThan(0);
  });

  it('starts, logs, and finishes a freestyle workout', () => {
    const exerciseId = firstExerciseId();

    const sessionId = startWorkout();
    expect(getActiveSession()?.id).toBe(sessionId);

    const setId = addSet({
      sessionId,
      exerciseId,
      setNumber: 1,
      reps: 5,
      weight: 100,
    });
    setSetCompleted(setId, true);

    finishWorkout(sessionId);

    // No active session once finished, and the row is stamped finished.
    expect(getActiveSession()).toBeUndefined();
    const session = rawSqlite()
      .prepare('SELECT finished_at FROM workout_sessions WHERE id = ?')
      .get(sessionId) as { finished_at: number | null };
    expect(session.finished_at).not.toBeNull();

    // The logged set persisted with its completion stamp.
    const set = rawSqlite()
      .prepare('SELECT reps, weight, completed_at FROM set_logs WHERE id = ?')
      .get(setId) as {
      reps: number;
      weight: number;
      completed_at: number | null;
    };
    expect(set.reps).toBe(5);
    expect(set.weight).toBe(100);
    expect(set.completed_at).not.toBeNull();
  });

  it('is idempotent on re-finish (no double transition)', () => {
    const sessionId = startWorkout();
    finishWorkout(sessionId);
    const first = rawSqlite()
      .prepare('SELECT finished_at FROM workout_sessions WHERE id = ?')
      .get(sessionId) as { finished_at: number };

    finishWorkout(sessionId);
    const second = rawSqlite()
      .prepare('SELECT finished_at FROM workout_sessions WHERE id = ?')
      .get(sessionId) as { finished_at: number };

    expect(second.finished_at).toBe(first.finished_at);
  });

  it('deletes a session and all of its set logs', () => {
    const exerciseId = firstExerciseId();
    const sessionId = startWorkout();
    addSet({ sessionId, exerciseId, setNumber: 1, reps: 5, weight: 100 });
    finishWorkout(sessionId);

    const before = rawSqlite()
      .prepare('SELECT COUNT(*) AS count FROM set_logs WHERE session_id = ?')
      .get(sessionId) as { count: number };
    expect(before.count).toBeGreaterThan(0);

    // Freestyle session ⇒ no program progression to roll back, so the return is
    // false; the point here is that the rows are gone afterwards.
    deleteSession(sessionId);

    const sets = rawSqlite()
      .prepare('SELECT COUNT(*) AS count FROM set_logs WHERE session_id = ?')
      .get(sessionId) as { count: number };
    const session = rawSqlite()
      .prepare('SELECT COUNT(*) AS count FROM workout_sessions WHERE id = ?')
      .get(sessionId) as { count: number };
    expect(sets.count).toBe(0);
    expect(session.count).toBe(0);
  });
});
