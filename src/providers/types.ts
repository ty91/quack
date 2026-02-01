export type TextChunk = {
  index: number;
  text: string;
  tokenCount: number;
};

export type RankedCandidate = {
  chunkId: number;
  score: number;
};

export type RerankerCandidate = {
  chunkId: number;
  text: string;
};

export type Chunker = {
  chunk: (text: string) => TextChunk[];
};

export type EmbeddingProvider = {
  embed: (texts: string[]) => Promise<number[][]>;
};

export type RerankerProvider = {
  rerank: (query: string, candidates: RerankerCandidate[]) => Promise<RankedCandidate[]>;
};

export type Mixer = {
  mix: (bm25: RankedCandidate[], vector: RankedCandidate[]) => RankedCandidate[];
};
