import os from "node:os";
import path from "node:path";
import type { Config } from "./schema.js";

export const DEFAULT_CONFIG_RELATIVE_PATH = ".quack/config.toml";

export function getDefaultConfigPath(): string {
  return path.join(os.homedir(), DEFAULT_CONFIG_RELATIVE_PATH);
}

export function getDefaultConfig(): Config {
  const dataDir = path.join(os.homedir(), ".quack");

  return {
    paths: {
      dataDir,
      dbPath: path.join(dataDir, "quack.db"),
      vectorIndexPath: path.join(dataDir, "index.hnsw"),
    },
    models: {
      cacheDir: path.join(dataDir, "models"),
      embedding: {
        provider: "llama-cpp-embedding",
        modelId: "google/embeddinggemma-300m",
        dimension: 768,
      },
      reranker: {
        provider: "transformers-js-reranker",
        modelId: "jinaai/jina-reranker-v2-base-multilingual",
      },
    },
    search: {
      top: 5,
      bm25K: 50,
      vectorK: 50,
      rerankK: 20,
      rrfK: 60,
    },
    chunking: {
      chunkTokens: 512,
      overlapTokens: 64,
    },
    providers: {
      embedding: "llama-cpp-embedding",
      reranker: "transformers-js-reranker",
      mixer: "rrf-mixer",
      chunker: "token-chunker",
    },
  };
}
