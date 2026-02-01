import type { Database as SqliteDatabase } from "better-sqlite3";
import { getIsoTimestamp } from "../time.js";
import type { FileRecord } from "../types.js";

type FileRow = {
  id: number;
  source_id: number;
  path: string;
  mtime: number;
  size: number;
  hash: string;
  is_deleted: number;
  updated_at: string;
};

type CreateFileInput = {
  sourceId: number;
  path: string;
  mtime: number;
  size: number;
  hash: string;
  isDeleted?: boolean;
};

type UpdateFileInput = {
  id: number;
  mtime: number;
  size: number;
  hash: string;
  isDeleted?: boolean;
};

export function createFilesRepository(database: SqliteDatabase) {
  const insertStatement = database.prepare(
    `INSERT INTO files (source_id, path, mtime, size, hash, is_deleted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const updateStatement = database.prepare(
    `UPDATE files
     SET mtime = ?, size = ?, hash = ?, is_deleted = ?, updated_at = ?
     WHERE id = ?`,
  );
  const markDeletedStatement = database.prepare(
    `UPDATE files SET is_deleted = 1, updated_at = ? WHERE id = ?`,
  );
  const findByIdStatement = database.prepare(`SELECT * FROM files WHERE id = ?`);
  const findByPathStatement = database.prepare(
    `SELECT * FROM files WHERE source_id = ? AND path = ?`,
  );
  const listBySourceStatement = database.prepare(
    `SELECT * FROM files WHERE source_id = ? ORDER BY path ASC`,
  );
  const countBySourceStatement = database.prepare(
    `SELECT COUNT(*) as count FROM files WHERE source_id = ? AND is_deleted = 0`,
  );
  const countAllBySourceStatement = database.prepare(
    `SELECT COUNT(*) as count FROM files WHERE source_id = ?`,
  );

  function createFile(input: CreateFileInput): FileRecord {
    const timestamp = getIsoTimestamp();
    const isDeleted = input.isDeleted ? 1 : 0;
    const result = insertStatement.run(
      input.sourceId,
      input.path,
      input.mtime,
      input.size,
      input.hash,
      isDeleted,
      timestamp,
    );
    const row = findByIdStatement.get(result.lastInsertRowid) as FileRow;
    return mapFileRow(row);
  }

  function updateFile(input: UpdateFileInput): FileRecord {
    const timestamp = getIsoTimestamp();
    const isDeleted = input.isDeleted ? 1 : 0;
    updateStatement.run(input.mtime, input.size, input.hash, isDeleted, timestamp, input.id);
    const row = findByIdStatement.get(input.id) as FileRow;
    return mapFileRow(row);
  }

  function markFileDeleted(id: number): void {
    markDeletedStatement.run(getIsoTimestamp(), id);
  }

  function getFileById(id: number): FileRecord | null {
    const row = findByIdStatement.get(id) as FileRow | undefined;
    return row ? mapFileRow(row) : null;
  }

  function getFileByPath(sourceId: number, filePath: string): FileRecord | null {
    const row = findByPathStatement.get(sourceId, filePath) as FileRow | undefined;
    return row ? mapFileRow(row) : null;
  }

  function listFilesBySource(sourceId: number): FileRecord[] {
    const rows = listBySourceStatement.all(sourceId) as FileRow[];
    return rows.map(mapFileRow);
  }

  function countFilesBySource(sourceId: number, includeDeleted = false): number {
    const row = includeDeleted
      ? (countAllBySourceStatement.get(sourceId) as { count: number })
      : (countBySourceStatement.get(sourceId) as { count: number });
    return row.count;
  }

  return {
    createFile,
    updateFile,
    markFileDeleted,
    getFileById,
    getFileByPath,
    listFilesBySource,
    countFilesBySource,
  };
}

function mapFileRow(row: FileRow): FileRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    path: row.path,
    mtime: row.mtime,
    size: row.size,
    hash: row.hash,
    isDeleted: row.is_deleted === 1,
    updatedAt: row.updated_at,
  };
}
