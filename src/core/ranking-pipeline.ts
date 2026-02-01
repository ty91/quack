import type {
  Mixer,
  RankedCandidate,
  RerankerCandidate,
  RerankerProvider,
} from "../providers/types.js";

export type RankingPipelineOptions = {
  mixer: Mixer;
  reranker: RerankerProvider;
  rerankLimit: number;
  top: number;
};

export type RankingResult = {
  chunkId: number;
  score: number;
  text: string;
};

export type RankingInput = {
  query: string;
  bm25: RankedCandidate[];
  vector: RankedCandidate[];
  candidates: RerankerCandidate[];
};

export class RankingPipeline {
  private readonly mixer: Mixer;
  private readonly reranker: RerankerProvider;
  private readonly rerankLimit: number;
  private readonly top: number;

  constructor(options: RankingPipelineOptions) {
    this.mixer = options.mixer;
    this.reranker = options.reranker;
    this.rerankLimit = options.rerankLimit;
    this.top = options.top;
  }

  async run(input: RankingInput): Promise<RankingResult[]> {
    const candidateTextById = new Map<number, string>();
    for (const candidate of input.candidates) {
      candidateTextById.set(candidate.chunkId, candidate.text);
    }

    const mixed = this.mixer.mix(input.bm25, input.vector);
    const rerankTargets = mixed
      .filter((candidate) => candidateTextById.has(candidate.chunkId))
      .slice(0, this.rerankLimit);

    const rerankInputs = rerankTargets.map((candidate) => ({
      chunkId: candidate.chunkId,
      text: candidateTextById.get(candidate.chunkId) ?? "",
    }));

    const reranked = await this.reranker.rerank(input.query, rerankInputs);

    const results: RankingResult[] = reranked.map((candidate) => ({
      chunkId: candidate.chunkId,
      score: candidate.score,
      text: candidateTextById.get(candidate.chunkId) ?? "",
    }));

    results.sort((left, right) => right.score - left.score);
    return results.slice(0, this.top);
  }
}
