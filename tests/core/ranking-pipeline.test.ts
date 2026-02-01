import { describe, expect, it } from "vitest";
import { RankingPipeline } from "../../src/core/ranking-pipeline.js";
import { RrfMixer } from "../../src/providers/mixer/rrf-mixer.js";
import type { RerankerProvider } from "../../src/providers/types.js";

describe("RankingPipeline", () => {
  it("returns top results after reranking", async () => {
    const reranker: RerankerProvider = {
      rerank: async (_query, candidates) => {
        return candidates.map((candidate) => ({
          chunkId: candidate.chunkId,
          score: candidate.chunkId,
        }));
      },
    };

    const pipeline = new RankingPipeline({
      mixer: new RrfMixer({ rrfK: 1 }),
      reranker,
      rerankLimit: 3,
      top: 2,
    });

    const results = await pipeline.run({
      query: "query",
      bm25: [
        { chunkId: 1, score: 0.9 },
        { chunkId: 2, score: 0.8 },
      ],
      vector: [
        { chunkId: 2, score: 0.7 },
        { chunkId: 3, score: 0.6 },
      ],
      candidates: [
        { chunkId: 1, text: "alpha" },
        { chunkId: 2, text: "beta" },
        { chunkId: 3, text: "gamma" },
      ],
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.chunkId).toBe(3);
    expect(results[1]?.chunkId).toBe(2);
  });
});
