import { describe, expect, it } from "vitest";
import { RrfMixer } from "../../src/providers/mixer/rrf-mixer.js";

describe("RrfMixer", () => {
  it("combines ranks with reciprocal scores", () => {
    const mixer = new RrfMixer({ rrfK: 60 });

    const bm25 = [
      { chunkId: 1, score: 2 },
      { chunkId: 2, score: 1.5 },
      { chunkId: 3, score: 1 },
    ];
    const vector = [
      { chunkId: 3, score: 0.9 },
      { chunkId: 2, score: 0.8 },
      { chunkId: 4, score: 0.7 },
    ];

    const mixed = mixer.mix(bm25, vector);

    const topTwo = mixed
      .slice(0, 2)
      .map((candidate) => candidate.chunkId)
      .sort();
    expect(topTwo).toEqual([2, 3]);
    expect(mixed.some((candidate) => candidate.chunkId === 1)).toBe(true);
    expect(mixed.some((candidate) => candidate.chunkId === 4)).toBe(true);
  });
});
