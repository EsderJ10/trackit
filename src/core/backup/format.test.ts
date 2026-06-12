import { describe, expect, it } from 'vitest';

import { type BackupTables, parseBackup, serializeBackup } from './format';

const SCHEMA = '0004_brown_pyro';
const tables: BackupTables = {
  exercises: [{ id: 1, name: 'Squat', equipment: null, is_custom: 0 }],
  routines: [{ id: 1, name: 'Leg day', description: null, created_at: 123 }],
};

describe('serialize / parse', () => {
  it('round trips data when the schema version matches', () => {
    const json = serializeBackup({
      schemaVersion: SCHEMA,
      exportedAt: 42,
      tables,
    });
    const result = parseBackup(json, SCHEMA);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.tables).toEqual(tables);
      expect(result.envelope.exportedAt).toBe(42);
    }
  });
});

describe('validation', () => {
  it('rejects invalid JSON', () => {
    expect(parseBackup('{ not json', SCHEMA).ok).toBe(false);
  });

  it('rejects a file that is not a TrackIt backup', () => {
    expect(parseBackup(JSON.stringify({ app: 'other' }), SCHEMA).ok).toBe(
      false,
    );
  });

  it('rejects a schema-version mismatch rather than restoring partially', () => {
    const json = serializeBackup({
      schemaVersion: 'OLD_VERSION',
      exportedAt: 0,
      tables,
    });
    const result = parseBackup(json, SCHEMA);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/different app version/);
  });

  it('rejects malformed table data', () => {
    const json = JSON.stringify({
      app: 'trackit',
      formatVersion: 1,
      schemaVersion: SCHEMA,
      exportedAt: 0,
      tables: { exercises: [{ id: { nested: true } }] },
    });
    expect(parseBackup(json, SCHEMA).ok).toBe(false);
  });
});
