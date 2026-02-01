import type { Database as SqliteDatabase } from "better-sqlite3";
import { getIsoTimestamp } from "../time.js";
import type { ChunkRecord } from "../types.js";

type ChunkRow = {
  id: number;
  file_id: number;
  chunk_index: number;
  token_count: number;
  is_deleted: number;
  updated_at: string;
};

type CreateChunkInput = {
  fileId: number;
  chunkIndex: number;
  tokenCount: number;
  text: string;
  sourceId: number;
  isDeleted?: boolean;
};

export function createChunksRepository(database: SqliteDatabase) {
  const insertChunkStatement = database.prepare(
    `INSERT INTO chunks (file_id, chunk_index, token_count, is_deleted, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insertFtsStatement = database.prepare(
    `INSERT INTO "chunks-fts" (chunk_id, text, is_deleted, source_id)
     VALUES (?, ?, ?, ?)`,
  );
  const markChunksDeletedStatement = database.prepare(
    `UPDATE chunks SET is_deleted = 1, updated_at = ? WHERE file_id = ?`,
  );
  const markFtsDeletedStatement = database.prepare(
    `UPDATE "chunks-fts" SET is_deleted = 1 WHERE chunk_id IN (
      SELECT id FROM chunks WHERE file_id = ?
     )`,
  );
  const deleteFtsStatement = database.prepare(
    `DELETE FROM "chunks-fts" WHERE chunk_id IN (
      SELECT id FROM chunks WHERE file_id = ?
     )`,
  );
  const deleteChunksStatement = database.prepare(`DELETE FROM chunks WHERE file_id = ?`);
  const findByIdStatement = database.prepare(`SELECT * FROM chunks WHERE id = ?`);
  const listByFileStatement = database.prepare(
    `SELECT * FROM chunks WHERE file_id = ? ORDER BY chunk_index ASC`,
  );

  function createChunk(input: CreateChunkInput): ChunkRecord {
    const timestamp = getIsoTimestamp();
    const isDeleted = input.isDeleted ? 1 : 0;

    const insertChunk = database.transaction(() => {
      const chunkResult = insertChunkStatement.run(
        input.fileId,
        input.chunkIndex,
        input.tokenCount,
        isDeleted,
        timestamp,
      );
      const chunkId = Number(chunkResult.lastInsertRowid);
      insertFtsStatement.run(chunkId, input.text, isDeleted, input.sourceId);
      const row = findByIdStatement.get(chunkId) as ChunkRow;
      return mapChunkRow(row);
    });

    return insertChunk();
  }

  function markChunksDeletedByFile(fileId: number): void {
    const timestamp = getIsoTimestamp();
    const markDeleted = database.transaction(() => {
      markChunksDeletedStatement.run(timestamp, fileId);
      markFtsDeletedStatement.run(fileId);
    });
    markDeleted();
  }

  function deleteChunksByFile(fileId: number): void {
    const removeChunks = database.transaction(() => {
      deleteFtsStatement.run(fileId);
      deleteChunksStatement.run(fileId);
    });
    removeChunks();
  }

  function listChunksByFile(fileId: number): ChunkRecord[] {
    const rows = listByFileStatement.all(fileId) as ChunkRow[];
    return rows.map(mapChunkRow);
  }

  return {
    createChunk,
    markChunksDeletedByFile,
    deleteChunksByFile,
    listChunksByFile,
  };
}

function mapChunkRow(row: ChunkRow): ChunkRecord {
  return {
    id: row.id,
    fileId: row.file_id,
    chunkIndex: row.chunk_index,
    tokenCount: row.token_count,
    isDeleted: row.is_deleted === 1,
    updatedAt: row.updated_at,
  };
}
