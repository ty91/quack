import type { ConnectorRegistry } from "../connectors/registry.js";
import type { Source } from "../connectors/types.js";
import type { Chunker, EmbeddingProvider } from "../providers/types.js";
import type { createChunksRepository } from "../storage/repositories/chunks-repository.js";
import type { createEmbeddingsRepository } from "../storage/repositories/embeddings-repository.js";
import type { createFilesRepository } from "../storage/repositories/files-repository.js";
import type { createSourcesRepository } from "../storage/repositories/sources-repository.js";
import type { createSyncRunsRepository } from "../storage/repositories/sync-runs-repository.js";
import type { EmbeddingStore } from "./embedding-store.js";
import type { SyncSummary } from "./types.js";

type SourcesRepository = ReturnType<typeof createSourcesRepository>;
type FilesRepository = ReturnType<typeof createFilesRepository>;
type ChunksRepository = ReturnType<typeof createChunksRepository>;
type EmbeddingsRepository = ReturnType<typeof createEmbeddingsRepository>;
type SyncRunsRepository = ReturnType<typeof createSyncRunsRepository>;

type SyncServiceOptions = {
  connectorRegistry: ConnectorRegistry;
  sourcesRepository: SourcesRepository;
  filesRepository: FilesRepository;
  chunksRepository: ChunksRepository;
  embeddingsRepository: EmbeddingsRepository;
  syncRunsRepository: SyncRunsRepository;
  chunker: Chunker;
  embeddingProvider: EmbeddingProvider;
  embeddingStore: EmbeddingStore;
  embeddingModelName: string;
  embeddingDimension: number;
};

export class SyncService {
  private readonly connectorRegistry: ConnectorRegistry;
  private readonly sourcesRepository: SourcesRepository;
  private readonly filesRepository: FilesRepository;
  private readonly chunksRepository: ChunksRepository;
  private readonly embeddingsRepository: EmbeddingsRepository;
  private readonly syncRunsRepository: SyncRunsRepository;
  private readonly chunker: Chunker;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly embeddingStore: EmbeddingStore;
  private readonly embeddingModelName: string;
  private readonly embeddingDimension: number;

  constructor(options: SyncServiceOptions) {
    this.connectorRegistry = options.connectorRegistry;
    this.sourcesRepository = options.sourcesRepository;
    this.filesRepository = options.filesRepository;
    this.chunksRepository = options.chunksRepository;
    this.embeddingsRepository = options.embeddingsRepository;
    this.syncRunsRepository = options.syncRunsRepository;
    this.chunker = options.chunker;
    this.embeddingProvider = options.embeddingProvider;
    this.embeddingStore = options.embeddingStore;
    this.embeddingModelName = options.embeddingModelName;
    this.embeddingDimension = options.embeddingDimension;
  }

  async syncSource(sourceId: number): Promise<SyncSummary> {
    const sourceRecord = this.sourcesRepository.getSourceById(sourceId);
    if (!sourceRecord) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    const connectorSource = mapSourceRecord(sourceRecord);
    const connector = this.connectorRegistry.getConnector(connectorSource);
    const syncRun = this.syncRunsRepository.startSyncRun({
      sourceId: sourceRecord.id,
      status: "running",
    });

    const existingFiles = this.filesRepository.listFilesBySource(sourceRecord.id);
    const existingFileMap = new Map(existingFiles.map((file) => [file.path, file]));

    let scannedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      const documents = await connector.listDocuments(connectorSource);
      scannedCount = documents.length;
      const documentPaths = new Set<string>();

      for (const document of documents) {
        documentPaths.add(document.path);
        const existing = existingFileMap.get(document.path);

        try {
          const metadata = await connector.getDocumentMetadata(document);

          if (!existing) {
            const file = this.filesRepository.createFile({
              sourceId: sourceRecord.id,
              path: document.path,
              mtime: metadata.mtime,
              size: metadata.size,
              hash: metadata.hash,
            });
            await this.processFile(connector, document, file.id, sourceRecord.id);
            createdCount += 1;
            continue;
          }

          if (
            existing.isDeleted ||
            existing.mtime !== metadata.mtime ||
            existing.hash !== metadata.hash
          ) {
            this.filesRepository.updateFile({
              id: existing.id,
              mtime: metadata.mtime,
              size: metadata.size,
              hash: metadata.hash,
              isDeleted: false,
            });
            this.chunksRepository.deleteChunksByFile(existing.id);
            this.embeddingsRepository.deleteEmbeddingsByFileId(existing.id);
            await this.processFile(connector, document, existing.id, sourceRecord.id);
            updatedCount += 1;
            continue;
          }

          skippedCount += 1;
        } catch (error) {
          errorCount += 1;
          console.warn(`Failed to process ${document.path}: ${formatError(error)}`);
        }
      }

      for (const existing of existingFiles) {
        if (documentPaths.has(existing.path)) {
          continue;
        }

        if (!existing.isDeleted) {
          this.filesRepository.markFileDeleted(existing.id);
          this.chunksRepository.markChunksDeletedByFile(existing.id);
          this.embeddingsRepository.deleteEmbeddingsByFileId(existing.id);
          deletedCount += 1;
        }
      }

      const changedCount = createdCount + updatedCount + deletedCount;
      this.syncRunsRepository.finishSyncRun({
        id: syncRun.id,
        status: "success",
        changedCount,
      });

      return {
        sourceId: sourceRecord.id,
        sourceName: sourceRecord.name,
        scannedCount,
        createdCount,
        updatedCount,
        deletedCount,
        skippedCount,
        errorCount,
        changedCount,
      };
    } catch (error) {
      this.syncRunsRepository.finishSyncRun({
        id: syncRun.id,
        status: "failed",
        changedCount: createdCount + updatedCount + deletedCount,
      });
      throw error;
    }
  }

  private async processFile(
    connector: ReturnType<ConnectorRegistry["getConnector"]>,
    document: { path: string; absolutePath?: string; sourceId: number },
    fileId: number,
    sourceId: number,
  ): Promise<void> {
    const content = await connector.readDocument(document);
    const chunks = this.chunker.chunk(content);

    if (chunks.length === 0) {
      return;
    }

    const chunkIds: number[] = [];
    const chunkTexts: string[] = [];

    for (const chunk of chunks) {
      const record = this.chunksRepository.createChunk({
        fileId,
        chunkIndex: chunk.index,
        tokenCount: chunk.tokenCount,
        text: chunk.text,
        sourceId,
      });
      chunkIds.push(record.id);
      chunkTexts.push(chunk.text);
    }

    const vectors = await this.embeddingProvider.embed(chunkTexts);
    this.embeddingStore.storeEmbeddings({
      chunkIds,
      vectors,
      modelName: this.embeddingModelName,
      dimension: this.embeddingDimension,
    });
  }
}

function mapSourceRecord(source: {
  id: number;
  name: string;
  connectorType: string;
  connectorConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}): Source {
  return {
    id: source.id,
    name: source.name,
    connectorType: source.connectorType as Source["connectorType"],
    connectorConfig: source.connectorConfig as unknown as Source["connectorConfig"],
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
