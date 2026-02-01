import type {
  EmbeddingProvider,
  Mixer,
  RankedCandidate,
  RerankerProvider,
} from "../providers/types.js";
import type { createChunkDetailsRepository } from "../storage/repositories/chunk-details-repository.js";
import type { createEmbeddingsRepository } from "../storage/repositories/embeddings-repository.js";
import type { createFullTextSearchRepository } from "../storage/repositories/full-text-search-repository.js";
import type { VectorIndex } from "../storage/vector-index/types.js";
import { RankingPipeline } from "./ranking-pipeline.js";
import type { SearchResult } from "./types.js";

type FullTextSearchRepository = ReturnType<typeof createFullTextSearchRepository>;
type EmbeddingsRepository = ReturnType<typeof createEmbeddingsRepository>;
type ChunkDetailsRepository = ReturnType<typeof createChunkDetailsRepository>;

type SearchServiceOptions = {
  fullTextSearchRepository: FullTextSearchRepository;
  embeddingsRepository: EmbeddingsRepository;
  chunkDetailsRepository: ChunkDetailsRepository;
  vectorIndex: VectorIndex;
  embeddingProvider: EmbeddingProvider;
  mixer: Mixer;
  reranker: RerankerProvider;
};

type SearchRequest = {
  query: string;
  top: number;
  bm25K: number;
  vectorK: number;
  rerankK: number;
  modelName: string;
};

export class SearchService {
  private readonly fullTextSearchRepository: FullTextSearchRepository;
  private readonly embeddingsRepository: EmbeddingsRepository;
  private readonly chunkDetailsRepository: ChunkDetailsRepository;
  private readonly vectorIndex: VectorIndex;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly mixer: Mixer;
  private readonly reranker: RerankerProvider;

  constructor(options: SearchServiceOptions) {
    this.fullTextSearchRepository = options.fullTextSearchRepository;
    this.embeddingsRepository = options.embeddingsRepository;
    this.chunkDetailsRepository = options.chunkDetailsRepository;
    this.vectorIndex = options.vectorIndex;
    this.embeddingProvider = options.embeddingProvider;
    this.mixer = options.mixer;
    this.reranker = options.reranker;
  }

  async search(request: SearchRequest): Promise<SearchResult[]> {
    if (!request.query.trim()) {
      return [];
    }

    const bm25Candidates = this.fullTextSearchRepository.search({
      query: request.query,
      limit: request.bm25K,
    });

    const vectorCandidates = await this.searchVectors(request);

    const candidateIds = new Set<number>();
    bm25Candidates.forEach((candidate) => candidateIds.add(candidate.chunkId));
    vectorCandidates.forEach((candidate) => candidateIds.add(candidate.chunkId));

    const chunkDetails = this.chunkDetailsRepository.getChunkDetailsByIds([...candidateIds]);
    if (chunkDetails.length === 0) {
      return [];
    }

    const detailsById = new Map(chunkDetails.map((detail) => [detail.chunkId, detail]));
    const rerankCandidates = chunkDetails.map((detail) => ({
      chunkId: detail.chunkId,
      text: detail.chunkText,
    }));

    const rankingPipeline = new RankingPipeline({
      mixer: this.mixer,
      reranker: this.reranker,
      rerankLimit: request.rerankK,
      top: request.top,
    });

    const ranked = await rankingPipeline.run({
      query: request.query,
      bm25: bm25Candidates,
      vector: vectorCandidates,
      candidates: rerankCandidates,
    });

    const results: SearchResult[] = [];
    for (const [index, candidate] of ranked.entries()) {
      const detail = detailsById.get(candidate.chunkId);
      if (!detail) {
        continue;
      }
      results.push({
        rank: index + 1,
        score: candidate.score,
        sourceName: detail.sourceName,
        filePath: detail.filePath,
        chunkText: detail.chunkText,
      });
    }

    return results;
  }

  private async searchVectors(request: SearchRequest): Promise<RankedCandidate[]> {
    if (request.vectorK <= 0) {
      return [];
    }

    const [queryVector] = await this.embeddingProvider.embed([request.query]);
    if (!queryVector) {
      return [];
    }

    const searchLimit = request.vectorK * 2;
    const vectorResults = this.vectorIndex.search(queryVector, searchLimit);
    if (vectorResults.length === 0) {
      return [];
    }

    const vectorIds = vectorResults.map((result) => result.vectorId);
    const mappings = this.embeddingsRepository.listEmbeddingsByVectorIds(
      vectorIds,
      request.modelName,
    );
    const chunkIdByVectorId = new Map(
      mappings.map((mapping) => [mapping.vectorId, mapping.chunkId]),
    );

    const results: RankedCandidate[] = [];
    const seen = new Set<number>();

    for (const result of vectorResults) {
      const chunkId = chunkIdByVectorId.get(result.vectorId);
      if (!chunkId || seen.has(chunkId)) {
        continue;
      }
      results.push({ chunkId, score: result.score });
      seen.add(chunkId);
      if (results.length >= request.vectorK) {
        break;
      }
    }

    return results;
  }
}
