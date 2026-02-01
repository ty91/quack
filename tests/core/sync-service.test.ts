import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ConnectorRegistry } from "../../src/connectors/registry.js";
import { EmbeddingStore } from "../../src/core/embedding-store.js";
import { SyncService } from "../../src/core/sync-service.js";
import { TokenChunker } from "../../src/providers/chunker/token-chunker.js";
import { MockEmbeddingProvider } from "../../src/providers/embedding/mock-embedding-provider.js";
import {
  createChunksRepository,
  createEmbeddingsRepository,
  createFilesRepository,
  createSourcesRepository,
  createSyncRunsRepository,
  InMemoryVectorIndex,
  openDatabase,
} from "../../src/storage/index.js";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("SyncService", () => {
  it("syncs new, updated, and deleted files", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "quack-sync-"));
    const filePath = path.join(tempDir, "notes.md");
    await fs.writeFile(filePath, buildTokens(60));

    const database = await openDatabase({ databasePath: ":memory:" });
    const sourcesRepository = createSourcesRepository(database);
    const filesRepository = createFilesRepository(database);
    const chunksRepository = createChunksRepository(database);
    const embeddingsRepository = createEmbeddingsRepository(database);
    const syncRunsRepository = createSyncRunsRepository(database);

    const source = sourcesRepository.createSource({
      name: "local",
      connectorType: "file-system",
      connectorConfig: { rootPath: tempDir },
    });

    const syncService = new SyncService({
      connectorRegistry: new ConnectorRegistry(),
      sourcesRepository,
      filesRepository,
      chunksRepository,
      embeddingsRepository,
      syncRunsRepository,
      chunker: new TokenChunker({
        chunkTokens: 50,
        overlapTokens: 10,
        minimumTokens: 20,
      }),
      embeddingProvider: new MockEmbeddingProvider({ dimension: 3 }),
      embeddingStore: new EmbeddingStore({
        embeddingsRepository,
        vectorIndex: new InMemoryVectorIndex(),
      }),
      embeddingModelName: "mock",
      embeddingDimension: 3,
    });

    const first = await syncService.syncSource(source.id);
    expect(first.createdCount).toBe(1);
    expect(first.updatedCount).toBe(0);
    expect(first.deletedCount).toBe(0);

    await fs.writeFile(filePath, buildTokens(70));
    const second = await syncService.syncSource(source.id);
    expect(second.createdCount).toBe(0);
    expect(second.updatedCount).toBe(1);
    expect(second.deletedCount).toBe(0);

    const fileRecord = filesRepository.getFileByPath(source.id, "notes.md");
    expect(fileRecord?.isDeleted).toBe(false);

    const chunks = chunksRepository.listChunksByFile(fileRecord?.id ?? 0);
    expect(chunks.some((chunk) => chunk.isDeleted)).toBe(false);
    expect(chunks.some((chunk) => !chunk.isDeleted)).toBe(true);

    await fs.rm(filePath);
    const third = await syncService.syncSource(source.id);
    expect(third.deletedCount).toBe(1);

    const deletedFile = filesRepository.getFileByPath(source.id, "notes.md");
    expect(deletedFile?.isDeleted).toBe(true);

    database.close();
  });
});

function buildTokens(count: number): string {
  return Array.from({ length: count }, (_, index) => `token${index + 1}`).join(" ");
}
