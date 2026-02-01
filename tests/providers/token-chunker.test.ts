import { describe, expect, it } from "vitest";
import { TokenChunker } from "../../src/providers/chunker/token-chunker.js";

describe("TokenChunker", () => {
  it("splits tokens with overlap", () => {
    const tokens = Array.from({ length: 120 }, (_, index) => `t${index + 1}`).join(" ");
    const chunker = new TokenChunker({
      chunkTokens: 50,
      overlapTokens: 10,
      minimumTokens: 20,
    });

    const chunks = chunker.chunk(tokens);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.tokenCount).toBe(50);
    expect(chunks[1]?.tokenCount).toBe(50);
    expect(chunks[2]?.tokenCount).toBe(40);
    expect(chunks[0]?.text.startsWith("t1")).toBe(true);
    expect(chunks[1]?.text.startsWith("t41")).toBe(true);
  });

  it("drops trailing chunks below minimum size", () => {
    const tokens = Array.from({ length: 55 }, (_, index) => `t${index + 1}`).join(" ");
    const chunker = new TokenChunker({
      chunkTokens: 50,
      overlapTokens: 10,
      minimumTokens: 20,
    });

    const chunks = chunker.chunk(tokens);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.tokenCount).toBe(50);
  });
});
