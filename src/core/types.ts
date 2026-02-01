export type SyncSummary = {
  sourceId: number;
  sourceName: string;
  scannedCount: number;
  createdCount: number;
  updatedCount: number;
  deletedCount: number;
  skippedCount: number;
  errorCount: number;
  changedCount: number;
};

export type SearchResult = {
  rank: number;
  score: number;
  sourceName: string;
  filePath: string;
  chunkText: string;
};
