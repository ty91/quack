import { describe, expect, it } from "vitest";
import { SearchService } from "../../src/core/search-service.js";
import { RrfMixer } from "../../src/providers/mixer/rrf-mixer.js";
import { MockEmbeddingProvider } from "../../src/providers/embedding/mock-embedding-provider.js";
import {
  createChunkDetailsRepository,
  createChunksRepository,
  createEmbeddingsRepository,
  createFilesRepository,
  createFullTextSearchRepository,
  createSourcesRepository,
  InMemoryVectorIndex,
  openDatabase,
} from "../../src/storage/index.js";
import { EmbeddingStore } from "../../src/core/embedding-store.js";
import type { RerankerProvider } from "../../src/providers/types.js";

describe("SearchService", () => {
  it("returns ranked search results", async () => {
    const database = await openDatabase({ databasePath: ":memory:" });
    const sourcesRepository = createSourcesRepository(database);
    const filesRepository = createFilesRepository(database);
    const chunksRepository = createChunksRepository(database);
    const embeddingsRepository = createEmbeddingsRepository(database);
    const fullTextSearchRepository = createFullTextSearchRepository(database);
    const chunkDetailsRepository = createChunkDetailsRepository(database);

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
      text: "hello world sample",
      sourceId: source.id,
    });

    const vectorIndex = new InMemoryVectorIndex();
    const embeddingProvider = new MockEmbeddingProvider({ dimension: 3 });
    const embeddingStore = new EmbeddingStore({
      embeddingsRepository,
      vectorIndex,
    });

    const [vector] = await embeddingProvider.embed(["hello world sample"]);
    embeddingStore.storeEmbeddings({
      chunkIds: [chunk.id],
      vectors: [vector],
      modelName: "mock",
      dimension: 3,
    });

    const reranker: RerankerProvider = {
      rerank: async (_query, candidates) =>
        candidates.map((candidate, index) => ({
          chunkId: candidate.chunkId,
          score: candidates.length - index,
        })),
    };

    const searchService = new SearchService({
      fullTextSearchRepository,
      embeddingsRepository,
      chunkDetailsRepository,
      vectorIndex,
      embeddingProvider,
      mixer: new RrfMixer({ rrfK: 10 }),
      reranker,
    });

    const results = await searchService.search({
      query: "hello",
      top: 5,
      bm25K: 5,
      vectorK: 5,
      rerankK: 5,
      modelName: "mock",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.sourceName).toBe("local");
    expect(results[0]?.filePath).toBe("notes.md");
    expect(results[0]?.chunkText).toContain("hello world sample");

    database.close();
  });
});
