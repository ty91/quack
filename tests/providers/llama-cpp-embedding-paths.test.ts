import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveEmbeddingModelPath } from "../../src/providers/embedding/llama-cpp-embedding-paths.js";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("resolveEmbeddingModelPath", () => {
  it("uses explicit modelPath", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "quack-model-"));
    const modelPath = path.join(tempDir, "model.gguf");
    await fs.writeFile(modelPath, "mock");

    const resolved = await resolveEmbeddingModelPath({
      modelPath,
      modelId: "google/embeddinggemma-300m",
      cacheDir: tempDir,
    });

    expect(resolved).toBe(modelPath);
  });

  it("resolves modelId under cacheDir", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "quack-cache-"));
    const cacheDir = path.join(tempDir, "models");
    const modelPath = path.join(cacheDir, "embedding", "google", "embeddinggemma-300m.gguf");
    await fs.mkdir(path.dirname(modelPath), { recursive: true });
    await fs.writeFile(modelPath, "mock");

    const resolved = await resolveEmbeddingModelPath({
      modelId: "google/embeddinggemma-300m",
      cacheDir,
    });

    expect(resolved).toBe(modelPath);
  });
});
