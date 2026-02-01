import crypto from "node:crypto";
import type { EmbeddingProvider } from "../types.js";

type MockEmbeddingOptions = {
  dimension: number;
};

export class MockEmbeddingProvider implements EmbeddingProvider {
  private readonly dimension: number;

  constructor(options: MockEmbeddingOptions) {
    if (options.dimension <= 0) {
      throw new Error("dimension must be positive");
    }
    this.dimension = options.dimension;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => buildVector(text, this.dimension));
  }
}

function buildVector(text: string, dimension: number): number[] {
  const seed = createSeed(text);
  const next = createRandom(seed);
  const vector: number[] = [];

  for (let index = 0; index < dimension; index += 1) {
    vector.push(next() * 2 - 1);
  }

  return vector;
}

function createSeed(text: string): number {
  const hash = crypto.createHash("sha256").update(text).digest();
  return hash.readUInt32LE(0);
}

function createRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
