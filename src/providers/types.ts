export type TextChunk = {
  index: number;
  text: string;
  tokenCount: number;
};

export type Chunker = {
  chunk: (text: string) => TextChunk[];
};

export type EmbeddingProvider = {
  embed: (texts: string[]) => Promise<number[][]>;
};
