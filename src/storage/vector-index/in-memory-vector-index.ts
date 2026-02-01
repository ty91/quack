import type { VectorIndex, VectorSearchResult } from "./types.js";

export class InMemoryVectorIndex implements VectorIndex {
  private vectors: number[][] = [];

  add(vectors: number[][]): number[] {
    const vectorIds: number[] = [];

    for (const vector of vectors) {
      const normalized = normalizeVector(vector);
      const vectorId = this.vectors.length;
      this.vectors.push(normalized);
      vectorIds.push(vectorId);
    }

    return vectorIds;
  }

  search(queryVector: number[], limit: number): VectorSearchResult[] {
    if (this.vectors.length === 0) {
      return [];
    }

    const normalizedQuery = normalizeVector(queryVector);
    const results: VectorSearchResult[] = this.vectors.map((vector, vectorId) => ({
      vectorId,
      score: dotProduct(normalizedQuery, vector),
    }));

    results.sort((left, right) => right.score - left.score);
    return results.slice(0, limit);
  }

  async save(): Promise<void> {
    return;
  }

  close(): void {
    this.vectors = [];
  }
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / magnitude);
}

function dotProduct(left: number[], right: number[]): number {
  let total = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    total += left[index] * right[index];
  }
  return total;
}
