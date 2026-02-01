export { openDatabase } from "./database.js";
export { applyMigrations } from "./migrations.js";
export { createSourcesRepository } from "./repositories/sources-repository.js";
export { createFilesRepository } from "./repositories/files-repository.js";
export { createChunksRepository } from "./repositories/chunks-repository.js";
export { createEmbeddingsRepository } from "./repositories/embeddings-repository.js";
export { createSyncRunsRepository } from "./repositories/sync-runs-repository.js";
export { createFullTextSearchRepository } from "./repositories/full-text-search-repository.js";
export { HierarchicalVectorIndex, InMemoryVectorIndex } from "./vector-index/index.js";
export type {
  ChunkRecord,
  EmbeddingRecord,
  FileRecord,
  SourceRecord,
  SyncRunRecord,
} from "./types.js";
export type { VectorIndex, VectorSearchResult } from "./vector-index/index.js";
export type { FullTextSearchResult } from "./repositories/full-text-search-repository.js";
