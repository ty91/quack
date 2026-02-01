import type { EmbeddingRecord } from "../storage/types.js";
import type { VectorIndex } from "../storage/vector-index/types.js";
import type { createEmbeddingsRepository } from "../storage/repositories/embeddings-repository.js";

type EmbeddingsRepository = ReturnType<typeof createEmbeddingsRepository>;

type EmbeddingStoreOptions = {
  embeddingsRepository: EmbeddingsRepository;
  vectorIndex: VectorIndex;
};

type StoreEmbeddingsInput = {
  chunkIds: number[];
  vectors: number[][];
  modelName: string;
  dimension: number;
};

export class EmbeddingStore {
  private readonly embeddingsRepository: EmbeddingsRepository;
  private readonly vectorIndex: VectorIndex;

  constructor(options: EmbeddingStoreOptions) {
    this.embeddingsRepository = options.embeddingsRepository;
    this.vectorIndex = options.vectorIndex;
  }

  storeEmbeddings(input: StoreEmbeddingsInput): EmbeddingRecord[] {
    if (input.chunkIds.length !== input.vectors.length) {
      throw new Error("chunkIds and vectors length mismatch");
    }

    ensureDimensions(input.vectors, input.dimension);

    const vectorIds = this.vectorIndex.add(input.vectors);
    if (vectorIds.length !== input.chunkIds.length) {
      throw new Error("vectorIds length mismatch");
    }

    const records: EmbeddingRecord[] = [];
    for (const [index, chunkId] of input.chunkIds.entries()) {
      const record = this.embeddingsRepository.createEmbedding({
        chunkId,
        vectorId: vectorIds[index],
        modelName: input.modelName,
        dimension: input.dimension,
      });
      records.push(record);
    }

    return records;
  }
}

function ensureDimensions(vectors: number[][], dimension: number): void {
  for (const vector of vectors) {
    if (vector.length !== dimension) {
      throw new Error("vector dimension mismatch");
    }
  }
}
