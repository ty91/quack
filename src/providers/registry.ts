import type { Config } from "../config/schema.js";
import { TokenChunker } from "./chunker/token-chunker.js";
import { MockEmbeddingProvider } from "./embedding/mock-embedding-provider.js";
import { RrfMixer } from "./mixer/rrf-mixer.js";
import { TransformersJsReranker } from "./reranker/transformers-js-reranker.js";
import type { Chunker, EmbeddingProvider, Mixer, RerankerProvider } from "./types.js";

type ProviderRegistryOptions = {
  config: Config;
};

export class ProviderRegistry {
  private readonly config: Config;

  constructor(options: ProviderRegistryOptions) {
    this.config = options.config;
  }

  getChunker(): Chunker {
    const name = this.config.providers.chunker;
    if (name === "token-chunker") {
      return new TokenChunker({
        chunkTokens: this.config.chunking.chunkTokens,
        overlapTokens: this.config.chunking.overlapTokens,
      });
    }

    throw new Error(`Unsupported chunker provider: ${name}`);
  }

  getEmbeddingProvider(): EmbeddingProvider {
    const name = this.config.providers.embedding;
    if (name === "mock-embedding") {
      return new MockEmbeddingProvider({
        dimension: this.config.models.embedding.dimension,
      });
    }

    if (name === "llama-cpp-embedding") {
      throw new Error("Embedding provider not implemented: llama-cpp-embedding");
    }

    throw new Error(`Unsupported embedding provider: ${name}`);
  }

  getRerankerProvider(): RerankerProvider {
    const name = this.config.providers.reranker;
    if (name === "transformers-js-reranker") {
      return new TransformersJsReranker({
        modelId: this.config.models.reranker.modelId,
      });
    }

    throw new Error(`Unsupported reranker provider: ${name}`);
  }

  getMixer(): Mixer {
    const name = this.config.providers.mixer;
    if (name === "rrf-mixer") {
      return new RrfMixer({ rrfK: this.config.search.rrfK });
    }

    throw new Error(`Unsupported mixer provider: ${name}`);
  }
}
