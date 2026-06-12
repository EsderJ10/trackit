/**
 * Pure (de)serialization + validation for backup files. No SQLite or native
 * imports live here, so this layer is unit-testable. The IO half — reading the
 * database and writing it back — lives in `backup.ts`.
 */

/** A SQLite scalar as returned/accepted by the driver. Booleans are stored as
 * integers, so there is no boolean case; blobs aren't used in our schema. */
export type SqlValue = string | number | null;
export type BackupRow = Record<string, SqlValue>;
export type BackupTables = Record<string, BackupRow[]>;

export const APP_TAG = 'trackit';
/** Envelope format version — bump only if this wrapper shape changes. */
export const FORMAT_VERSION = 1;

export interface BackupEnvelope {
  app: typeof APP_TAG;
  formatVersion: number;
  /** Latest applied migration tag (e.g. '0004_brown_pyro'); gates restore. */
  schemaVersion: string;
  exportedAt: number;
  tables: BackupTables;
}

export type ParseResult =
  | { ok: true; envelope: BackupEnvelope }
  | { ok: false; error: string };

export function serializeBackup(input: {
  schemaVersion: string;
  exportedAt: number;
  tables: BackupTables;
}): string {
  const envelope: BackupEnvelope = {
    app: APP_TAG,
    formatVersion: FORMAT_VERSION,
    schemaVersion: input.schemaVersion,
    exportedAt: input.exportedAt,
    tables: input.tables,
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Parse and validate a backup file against the device's current schema. Rejects
 * (rather than partially restoring) on anything unexpected — most importantly a
 * `schemaVersion` mismatch, which would otherwise fail mid-INSERT against a
 * changed table shape.
 */
export function parseBackup(
  json: string,
  currentSchemaVersion: string,
): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'This file is not a TrackIt backup.' };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.app !== APP_TAG) {
    return { ok: false, error: 'This file is not a TrackIt backup.' };
  }
  if (obj.formatVersion !== FORMAT_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup format (v${String(obj.formatVersion)}).`,
    };
  }
  if (typeof obj.schemaVersion !== 'string') {
    return { ok: false, error: 'Backup is missing its schema version.' };
  }
  if (obj.schemaVersion !== currentSchemaVersion) {
    return {
      ok: false,
      error:
        'This backup was made on a different app version and cannot be ' +
        'restored. Update TrackIt to match the backup, then try again.',
    };
  }
  if (!isBackupTables(obj.tables)) {
    return { ok: false, error: 'Backup data is malformed.' };
  }

  return {
    ok: true,
    envelope: {
      app: APP_TAG,
      formatVersion: FORMAT_VERSION,
      schemaVersion: obj.schemaVersion,
      exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : 0,
      tables: obj.tables,
    },
  };
}

function isSqlValue(value: unknown): value is SqlValue {
  return (
    value === null || typeof value === 'string' || typeof value === 'number'
  );
}

function isBackupRow(value: unknown): value is BackupRow {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every(isSqlValue);
}

function isBackupTables(value: unknown): value is BackupTables {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every(
    (rows) => Array.isArray(rows) && rows.every(isBackupRow),
  );
}
