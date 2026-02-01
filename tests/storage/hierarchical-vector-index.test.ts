import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { HierarchicalVectorIndex } from "../../src/storage/vector-index/hierarchical-vector-index.js";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("HierarchicalVectorIndex", () => {
  it("persists and searches vectors", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "quack-index-"));
    const indexPath = path.join(tempDir, "vectors.bin");

    const index = await openIndexSafely({
      indexPath,
      dimension: 3,
      maxElements: 10,
      space: "cosine",
      searchEffort: 20,
    });
    if (!index) {
      return;
    }

    const [firstId] = index.add([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);

    await index.save();
    index.close();

    const reopened = await openIndexSafely({
      indexPath,
      dimension: 3,
      maxElements: 10,
      space: "cosine",
      searchEffort: 20,
    });
    if (!reopened) {
      return;
    }

    const results = reopened.search([1, 0, 0], 1);

    expect(results[0]?.vectorId).toBe(firstId);
    reopened.close();
  });
});

async function openIndexSafely(options: {
  indexPath: string;
  dimension: number;
  maxElements: number;
  space: "cosine";
  searchEffort: number;
}): Promise<HierarchicalVectorIndex | null> {
  try {
    return await HierarchicalVectorIndex.open(options);
  } catch (error) {
    if (isMissingNativeBinding(error)) {
      console.warn("Skipping HNSW test: native binding unavailable.");
      return null;
    }
    throw error;
  }
}

function isMissingNativeBinding(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes("Could not locate the bindings file");
}
