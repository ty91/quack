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

type EmbeddingMappingRow = {
  chunk_id: number;
  vector_id: number;
};

type CreateEmbeddingInput = {
  chunkId: number;
  vectorId: number;
  modelName: string;
  dimension: number;
};

type VectorIdMapping = {
  vectorId: number;
  chunkId: number;
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
  const deleteByFileStatement = database.prepare(
    `DELETE FROM embeddings WHERE chunk_id IN (
      SELECT id FROM chunks WHERE file_id = ?
    )`,
  );

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

  function listEmbeddingsByVectorIds(vectorIds: number[], modelName?: string): VectorIdMapping[] {
    if (vectorIds.length === 0) {
      return [];
    }

    const placeholders = vectorIds.map(() => "?").join(", ");
    const baseQuery = `SELECT e.vector_id, e.chunk_id
      FROM embeddings e
      INNER JOIN chunks c ON e.chunk_id = c.id
      WHERE e.vector_id IN (${placeholders})
        AND c.is_deleted = 0`;

    const statement = modelName
      ? database.prepare(`${baseQuery} AND e.model_name = ?`)
      : database.prepare(baseQuery);

    const rows = modelName
      ? (statement.all(...vectorIds, modelName) as EmbeddingMappingRow[])
      : (statement.all(...vectorIds) as EmbeddingMappingRow[]);

    return rows.map((row) => ({
      vectorId: row.vector_id,
      chunkId: row.chunk_id,
    }));
  }

  function deleteEmbeddingsByFileId(fileId: number): void {
    deleteByFileStatement.run(fileId);
  }

  return {
    createEmbedding,
    listEmbeddingsByChunk,
    listEmbeddingsByVectorIds,
    deleteEmbeddingsByFileId,
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
