import type { Database as SqliteDatabase } from "better-sqlite3";
import { getIsoTimestamp } from "../time.js";
import type { EmbeddingRecord } from "../types.js";

type EmbeddingRow = {
  id: number;
  chunk_id: number;
  vector_id: number;
  model_name: string;
  dimension: number;
  created_at: string;
};

type CreateEmbeddingInput = {
  chunkId: number;
  vectorId: number;
  modelName: string;
  dimension: number;
};

export function createEmbeddingsRepository(database: SqliteDatabase) {
  const insertStatement = database.prepare(
    `INSERT INTO embeddings (chunk_id, vector_id, model_name, dimension, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const findByChunkStatement = database.prepare(
    `SELECT * FROM embeddings WHERE chunk_id = ? ORDER BY id ASC`,
  );
  const findByIdStatement = database.prepare(`SELECT * FROM embeddings WHERE id = ?`);

  function createEmbedding(input: CreateEmbeddingInput): EmbeddingRecord {
    const timestamp = getIsoTimestamp();
    const result = insertStatement.run(
      input.chunkId,
      input.vectorId,
      input.modelName,
      input.dimension,
      timestamp,
    );
    const row = findByIdStatement.get(result.lastInsertRowid) as EmbeddingRow;
    return mapEmbeddingRow(row);
  }

  function listEmbeddingsByChunk(chunkId: number): EmbeddingRecord[] {
    const rows = findByChunkStatement.all(chunkId) as EmbeddingRow[];
    return rows.map(mapEmbeddingRow);
  }

  return {
    createEmbedding,
    listEmbeddingsByChunk,
  };
}

function mapEmbeddingRow(row: EmbeddingRow): EmbeddingRecord {
  return {
    id: row.id,
    chunkId: row.chunk_id,
    vectorId: row.vector_id,
    modelName: row.model_name,
    dimension: row.dimension,
    createdAt: row.created_at,
  };
}
