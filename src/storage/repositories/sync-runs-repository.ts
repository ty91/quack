import type { Database as SqliteDatabase } from "better-sqlite3";
import { getIsoTimestamp } from "../time.js";
import type { SyncRunRecord } from "../types.js";

type SyncRunRow = {
  id: number;
  source_id: number;
  started_at: string;
  ended_at: string | null;
  status: string;
  changed_count: number;
};

type StartSyncRunInput = {
  sourceId: number;
  status: string;
};

type FinishSyncRunInput = {
  id: number;
  status: string;
  changedCount: number;
};

export function createSyncRunsRepository(database: SqliteDatabase) {
  const insertStatement = database.prepare(
    `INSERT INTO "sync-runs" (source_id, started_at, ended_at, status, changed_count)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const updateStatement = database.prepare(
    `UPDATE "sync-runs"
     SET ended_at = ?, status = ?, changed_count = ?
     WHERE id = ?`,
  );
  const findByIdStatement = database.prepare(`SELECT * FROM "sync-runs" WHERE id = ?`);
  const listBySourceStatement = database.prepare(
    `SELECT * FROM "sync-runs" WHERE source_id = ? ORDER BY started_at DESC`,
  );

  function startSyncRun(input: StartSyncRunInput): SyncRunRecord {
    const timestamp = getIsoTimestamp();
    const result = insertStatement.run(input.sourceId, timestamp, null, input.status, 0);
    const row = findByIdStatement.get(result.lastInsertRowid) as SyncRunRow;
    return mapSyncRunRow(row);
  }

  function finishSyncRun(input: FinishSyncRunInput): SyncRunRecord {
    const timestamp = getIsoTimestamp();
    updateStatement.run(timestamp, input.status, input.changedCount, input.id);
    const row = findByIdStatement.get(input.id) as SyncRunRow;
    return mapSyncRunRow(row);
  }

  function listSyncRunsBySource(sourceId: number): SyncRunRecord[] {
    const rows = listBySourceStatement.all(sourceId) as SyncRunRow[];
    return rows.map(mapSyncRunRow);
  }

  return {
    startSyncRun,
    finishSyncRun,
    listSyncRunsBySource,
  };
}

function mapSyncRunRow(row: SyncRunRow): SyncRunRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
    changedCount: row.changed_count,
  };
}
