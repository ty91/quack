import { describe, expect, it } from "vitest";
import { MockEmbeddingProvider } from "../../src/providers/embedding/mock-embedding-provider.js";

describe("MockEmbeddingProvider", () => {
  it("returns deterministic vectors", async () => {
    const provider = new MockEmbeddingProvider({ dimension: 8 });
    const [first] = await provider.embed(["hello"]);
    const [second] = await provider.embed(["hello"]);
    const [other] = await provider.embed(["world"]);

    expect(first).toEqual(second);
    expect(first).not.toEqual(other);
    expect(first).toHaveLength(8);
  });
});
