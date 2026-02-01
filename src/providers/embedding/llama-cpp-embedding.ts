import type { EmbeddingProvider } from "../types.js";
import { resolveEmbeddingModelPath } from "./llama-cpp-embedding-paths.js";

type LlamaCppEmbeddingOptions = {
  modelPath?: string;
  modelId: string;
  cacheDir: string;
  dimension?: number;
};

type EmbeddingVector = number[] | Float32Array | ReadonlyArray<number>;

type EmbeddingResult = {
  vector: EmbeddingVector;
};

type EmbeddingContext = {
  getEmbeddingFor: (text: string) => Promise<EmbeddingResult>;
};

export class LlamaCppEmbeddingProvider implements EmbeddingProvider {
  private readonly options: LlamaCppEmbeddingOptions;
  private embeddingContextPromise: Promise<EmbeddingContext> | null = null;
  private validatedDimension: boolean = false;

  constructor(options: LlamaCppEmbeddingOptions) {
    this.options = options;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const context = await this.getEmbeddingContext();
    const vectors: number[][] = [];

    for (const text of texts) {
      const embedding = await context.getEmbeddingFor(text);
      const vector = Array.from(embedding.vector);
      vectors.push(vector);
    }

    this.ensureDimension(vectors);
    return vectors;
  }

  private async getEmbeddingContext(): Promise<EmbeddingContext> {
    if (!this.embeddingContextPromise) {
      this.embeddingContextPromise = this.createEmbeddingContext();
    }

    return this.embeddingContextPromise;
  }

  private async createEmbeddingContext(): Promise<EmbeddingContext> {
    const modelPath = await resolveEmbeddingModelPath(this.options);

    try {
      const module = await import("node-llama-cpp");
      const llama = await module.getLlama();
      const model = await llama.loadModel({ modelPath });
      return (await model.createEmbeddingContext()) as EmbeddingContext;
    } catch (error) {
      throw new Error(`Failed to initialize llama.cpp embedding: ${formatError(error)}`);
    }
  }

  private ensureDimension(vectors: number[][]): void {
    if (this.validatedDimension) {
      return;
    }

    if (this.options.dimension === undefined) {
      this.validatedDimension = true;
      return;
    }

    for (const vector of vectors) {
      if (vector.length !== this.options.dimension) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.options.dimension}, got ${vector.length}`,
        );
      }
    }

    this.validatedDimension = true;
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
