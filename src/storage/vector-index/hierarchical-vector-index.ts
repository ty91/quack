import fs from "node:fs/promises";
import path from "node:path";
import type { VectorIndex, VectorSearchResult } from "./types.js";

type VectorSpace = "l2" | "ip" | "cosine";

type HnswIndex = {
  initIndex: (options: {
    maxElements: number;
    m?: number;
    efConstruction?: number;
    randomSeed?: number;
    allowReplaceDeleted?: boolean;
  }) => void;
  readIndexSync: (filePath: string, allowReplaceDeleted?: boolean) => void;
  writeIndex: (filePath: string) => Promise<boolean>;
  resizeIndex: (maxElements: number) => void;
  addPoint: (point: number[], label: number) => void;
  searchKnn: (
    queryPoint: number[],
    neighbors: number,
  ) => { distances: number[]; neighbors: number[] };
  getIdsList: () => number[];
  getMaxElements: () => number;
  setEf: (value: number) => void;
};

type HierarchicalVectorIndexOptions = {
  indexPath: string;
  dimension: number;
  maxElements: number;
  space?: VectorSpace;
  maxConnections?: number;
  constructionEffort?: number;
  searchEffort?: number;
  randomSeed?: number;
  allowReplaceDeleted?: boolean;
};

export class HierarchicalVectorIndex implements VectorIndex {
  private readonly index: HnswIndex;
  private readonly indexPath: string;
  private readonly space: VectorSpace;
  private nextVectorId: number;

  private constructor(
    index: HnswIndex,
    indexPath: string,
    space: VectorSpace,
    nextVectorId: number,
  ) {
    this.index = index;
    this.indexPath = indexPath;
    this.space = space;
    this.nextVectorId = nextVectorId;
  }

  static async open(options: HierarchicalVectorIndexOptions): Promise<HierarchicalVectorIndex> {
    const space = options.space ?? "cosine";
    const { HierarchicalNSW } = await import("hnswlib-node");
    const index = new HierarchicalNSW(space, options.dimension) as HnswIndex;
    const allowReplaceDeleted = options.allowReplaceDeleted ?? false;

    await fs.mkdir(path.dirname(options.indexPath), { recursive: true });

    if (await fileExists(options.indexPath)) {
      index.readIndexSync(options.indexPath, allowReplaceDeleted);
    } else {
      index.initIndex({
        maxElements: options.maxElements,
        m: options.maxConnections,
        efConstruction: options.constructionEffort,
        randomSeed: options.randomSeed,
        allowReplaceDeleted,
      });
    }

    if (options.maxElements > index.getMaxElements()) {
      index.resizeIndex(options.maxElements);
    }

    if (options.searchEffort) {
      index.setEf(options.searchEffort);
    }

    const nextVectorId = resolveNextVectorId(index);
    return new HierarchicalVectorIndex(index, options.indexPath, space, nextVectorId);
  }

  add(vectors: number[][]): number[] {
    this.ensureCapacity(vectors.length);

    const vectorIds: number[] = [];
    for (const vector of vectors) {
      const vectorId = this.nextVectorId;
      this.index.addPoint(vector, vectorId);
      vectorIds.push(vectorId);
      this.nextVectorId += 1;
    }

    return vectorIds;
  }

  search(queryVector: number[], limit: number): VectorSearchResult[] {
    if (limit <= 0) {
      return [];
    }

    const result = this.index.searchKnn(queryVector, limit);
    const results: VectorSearchResult[] = result.neighbors.map((vectorId, index) => ({
      vectorId,
      score: distanceToScore(result.distances[index] ?? 0, this.space),
    }));

    results.sort((left, right) => right.score - left.score);
    return results;
  }

  async save(): Promise<void> {
    await this.index.writeIndex(this.indexPath);
  }

  close(): void {
    return;
  }

  private ensureCapacity(additional: number): void {
    const required = this.nextVectorId + additional;
    if (required <= this.index.getMaxElements()) {
      return;
    }
    this.index.resizeIndex(required);
  }
}

function resolveNextVectorId(index: HnswIndex): number {
  const ids = index.getIdsList();
  if (ids.length === 0) {
    return 0;
  }
  return Math.max(...ids) + 1;
}

function distanceToScore(distance: number, space: VectorSpace): number {
  if (space === "l2") {
    return -distance;
  }
  return 1 - distance;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
