export type SourceRecord = {
  id: number;
  name: string;
  connectorType: string;
  connectorConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FileRecord = {
  id: number;
  sourceId: number;
  path: string;
  mtime: number;
  size: number;
  hash: string;
  isDeleted: boolean;
  updatedAt: string;
};

export type ChunkRecord = {
  id: number;
  fileId: number;
  chunkIndex: number;
  tokenCount: number;
  isDeleted: boolean;
  updatedAt: string;
};

export type EmbeddingRecord = {
  id: number;
  chunkId: number;
  vectorId: number;
  modelName: string;
  dimension: number;
  createdAt: string;
};

export type SyncRunRecord = {
  id: number;
  sourceId: number;
  startedAt: string;
  endedAt: string | null;
  status: string;
  changedCount: number;
};
