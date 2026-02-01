import type { Chunker, TextChunk } from "../types.js";

type TokenChunkerOptions = {
  chunkTokens: number;
  overlapTokens: number;
  minimumTokens: number;
};

const defaultOptions: TokenChunkerOptions = {
  chunkTokens: 512,
  overlapTokens: 64,
  minimumTokens: 50,
};

type TokenPosition = {
  start: number;
  end: number;
};

export class TokenChunker implements Chunker {
  private readonly options: TokenChunkerOptions;

  constructor(options: Partial<TokenChunkerOptions> = {}) {
    this.options = {
      ...defaultOptions,
      ...options,
    };

    if (this.options.overlapTokens >= this.options.chunkTokens) {
      throw new Error("overlapTokens must be less than chunkTokens");
    }
  }

  chunk(text: string): TextChunk[] {
    const normalized = text.trim();
    if (!normalized) {
      return [];
    }

    const tokenPositions = collectTokenPositions(normalized);
    if (tokenPositions.length === 0) {
      return [];
    }

    const chunks: TextChunk[] = [];
    const { chunkTokens, overlapTokens, minimumTokens } = this.options;

    let startIndex = 0;
    while (startIndex < tokenPositions.length) {
      const endIndex = Math.min(startIndex + chunkTokens, tokenPositions.length);
      const tokenCount = endIndex - startIndex;

      if (tokenCount < minimumTokens) {
        break;
      }

      const startPosition = tokenPositions[startIndex].start;
      const endPosition = tokenPositions[endIndex - 1].end;
      const chunkText = normalized.slice(startPosition, endPosition);

      chunks.push({
        index: chunks.length,
        text: chunkText,
        tokenCount,
      });

      if (endIndex >= tokenPositions.length) {
        break;
      }

      startIndex = Math.max(0, endIndex - overlapTokens);
    }

    return chunks;
  }
}

function collectTokenPositions(text: string): TokenPosition[] {
  const positions: TokenPosition[] = [];
  const matcher = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(text)) !== null) {
    positions.push({ start: match.index, end: match.index + match[0].length });
  }

  return positions;
}
