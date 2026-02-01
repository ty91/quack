import { describe, expect, it } from "vitest";
import {
  createChunksRepository,
  createEmbeddingsRepository,
  createFilesRepository,
  createSourcesRepository,
  InMemoryVectorIndex,
  openDatabase,
} from "../../src/storage/index.js";
import { EmbeddingStore } from "../../src/core/embedding-store.js";

describe("EmbeddingStore", () => {
  it("stores embeddings with vector ids", async () => {
    const database = await openDatabase({ databasePath: ":memory:" });
    const sourcesRepository = createSourcesRepository(database);
    const filesRepository = createFilesRepository(database);
    const chunksRepository = createChunksRepository(database);
    const embeddingsRepository = createEmbeddingsRepository(database);

    const source = sourcesRepository.createSource({
      name: "local",
      connectorType: "file-system",
      connectorConfig: { rootPath: "/tmp" },
    });
    const file = filesRepository.createFile({
      sourceId: source.id,
      path: "notes.md",
      mtime: 1,
      size: 10,
      hash: "hash",
    });
    const chunk = chunksRepository.createChunk({
      fileId: file.id,
      chunkIndex: 0,
      tokenCount: 3,
      text: "hello world",
      sourceId: source.id,
    });

    const store = new EmbeddingStore({
      embeddingsRepository,
      vectorIndex: new InMemoryVectorIndex(),
    });

    const records = store.storeEmbeddings({
      chunkIds: [chunk.id],
      vectors: [[0.2, 0.4, 0.6]],
      modelName: "mock",
      dimension: 3,
    });

    const embeddings = embeddingsRepository.listEmbeddingsByChunk(chunk.id);

    expect(records).toHaveLength(1);
    expect(embeddings).toHaveLength(1);
    expect(embeddings[0]?.vectorId).toBe(0);
    expect(embeddings[0]?.dimension).toBe(3);

    database.close();
  });
});
