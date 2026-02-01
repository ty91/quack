export type VectorSearchResult = {
  vectorId: number;
  score: number;
};

export type VectorIndex = {
  add: (vectors: number[][]) => number[];
  search: (queryVector: number[], limit: number) => VectorSearchResult[];
  save: () => Promise<void>;
  close: () => void;
};
