import type { Database as SqliteDatabase } from "better-sqlite3";

export type FullTextSearchResult = {
  chunkId: number;
  score: number;
};

type SearchOptions = {
  query: string;
  limit: number;
  sourceId?: number;
};

type SearchRow = {
  chunk_id: number;
  score: number;
};

export function createFullTextSearchRepository(database: SqliteDatabase) {
  const baseQuery = `
    SELECT chunk_id, bm25("chunks-fts") as score
    FROM "chunks-fts"
    WHERE "chunks-fts" MATCH ? AND is_deleted = 0
  `;

  const searchStatement = database.prepare(`${baseQuery} ORDER BY score LIMIT ?`);
  const searchBySourceStatement = database.prepare(
    `${baseQuery} AND source_id = ? ORDER BY score LIMIT ?`,
  );

  function search(options: SearchOptions): FullTextSearchResult[] {
    const rows = options.sourceId
      ? (searchBySourceStatement.all(options.query, options.sourceId, options.limit) as SearchRow[])
      : (searchStatement.all(options.query, options.limit) as SearchRow[]);

    return rows.map((row) => ({
      chunkId: row.chunk_id,
      score: -row.score,
    }));
  }

  return {
    search,
  };
}
