import { describe, expect, it } from "vitest";
import {
  createChunksRepository,
  createFilesRepository,
  createFullTextSearchRepository,
  createSourcesRepository,
  openDatabase,
} from "../../src/storage/index.js";

describe("FullTextSearchRepository", () => {
  it("filters deleted chunks and supports source filter", async () => {
    const database = await openDatabase({ databasePath: ":memory:" });
    const sourcesRepository = createSourcesRepository(database);
    const filesRepository = createFilesRepository(database);
    const chunksRepository = createChunksRepository(database);
    const searchRepository = createFullTextSearchRepository(database);

    const sourceA = sourcesRepository.createSource({
      name: "alpha",
      connectorType: "file-system",
      connectorConfig: { rootPath: "/tmp/a" },
    });
    const sourceB = sourcesRepository.createSource({
      name: "beta",
      connectorType: "file-system",
      connectorConfig: { rootPath: "/tmp/b" },
    });

    const fileA = filesRepository.createFile({
      sourceId: sourceA.id,
      path: "a.md",
      mtime: 1,
      size: 10,
      hash: "hash-a",
    });
    const fileB = filesRepository.createFile({
      sourceId: sourceB.id,
      path: "b.md",
      mtime: 1,
      size: 10,
      hash: "hash-b",
    });

    const chunkA = chunksRepository.createChunk({
      fileId: fileA.id,
      chunkIndex: 0,
      tokenCount: 2,
      text: "alpha beta",
      sourceId: sourceA.id,
    });
    const chunkB = chunksRepository.createChunk({
      fileId: fileB.id,
      chunkIndex: 0,
      tokenCount: 2,
      text: "alpha gamma",
      sourceId: sourceB.id,
    });

    chunksRepository.markChunksDeletedByFile(fileB.id);

    const results = searchRepository.search({
      query: "alpha",
      limit: 10,
      sourceId: sourceA.id,
    });

    expect(results.map((result) => result.chunkId)).toEqual([chunkA.id]);
    expect(results.find((result) => result.chunkId === chunkB.id)).toBeUndefined();

    database.close();
  });
});
