import { describe, expect, it } from "vitest";
import { TransformersJsReranker } from "../../src/providers/reranker/transformers-js-reranker.js";

describe("TransformersJsReranker", () => {
  it("reranks candidates using pipeline scores", async () => {
    const reranker = new TransformersJsReranker({
      modelId: "mock-model",
      pipelineFactory: async () => {
        return async (inputs) => {
          const inputList = Array.isArray(inputs) ? inputs : [inputs];
          return inputList.map((_, index) => ({ score: index }));
        };
      },
    });

    const results = await reranker.rerank("query", [
      { chunkId: 10, text: "alpha" },
      { chunkId: 20, text: "beta" },
      { chunkId: 30, text: "gamma" },
    ]);

    expect(results[0]?.chunkId).toBe(30);
    expect(results[1]?.chunkId).toBe(20);
    expect(results[2]?.chunkId).toBe(10);
  });
});
