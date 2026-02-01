import type { Database as SqliteDatabase } from "better-sqlite3";

export type ChunkDetail = {
  chunkId: number;
  chunkText: string;
  filePath: string;
  sourceId: number;
  sourceName: string;
};

type ChunkDetailRow = {
  chunk_id: number;
  chunk_text: string;
  file_path: string;
  source_id: number;
  source_name: string;
};

export function createChunkDetailsRepository(database: SqliteDatabase) {
  function getChunkDetailsByIds(chunkIds: number[]): ChunkDetail[] {
    if (chunkIds.length === 0) {
      return [];
    }

    const placeholders = chunkIds.map(() => "?").join(", ");
    const statement = database.prepare(
      `SELECT c.id as chunk_id,
              f.path as file_path,
              s.id as source_id,
              s.name as source_name,
              ft.text as chunk_text
       FROM chunks c
       INNER JOIN files f ON c.file_id = f.id
       INNER JOIN sources s ON f.source_id = s.id
       INNER JOIN "chunks-fts" ft ON ft.chunk_id = c.id
       WHERE c.id IN (${placeholders})
         AND c.is_deleted = 0
         AND f.is_deleted = 0
         AND ft.is_deleted = 0`,
    );

    const rows = statement.all(...chunkIds) as ChunkDetailRow[];
    return rows.map((row) => ({
      chunkId: row.chunk_id,
      chunkText: row.chunk_text,
      filePath: row.file_path,
      sourceId: row.source_id,
      sourceName: row.source_name,
    }));
  }

  return {
    getChunkDetailsByIds,
  };
}
