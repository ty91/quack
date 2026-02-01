import type { RankedCandidate, RerankerCandidate, RerankerProvider } from "../types.js";

type Pipeline = (inputs: unknown) => Promise<unknown>;

type PipelineFactory = (task: string, modelId: string) => Promise<Pipeline>;

type TransformersJsRerankerOptions = {
  modelId: string;
  pipelineFactory?: PipelineFactory;
};

const defaultTask = "text-classification";

export class TransformersJsReranker implements RerankerProvider {
  private readonly modelId: string;
  private readonly pipelineFactory: PipelineFactory;
  private pipelinePromise: Promise<Pipeline> | null = null;

  constructor(options: TransformersJsRerankerOptions) {
    this.modelId = options.modelId;
    this.pipelineFactory = options.pipelineFactory ?? createDefaultPipelineFactory();
  }

  async rerank(query: string, candidates: RerankerCandidate[]): Promise<RankedCandidate[]> {
    if (candidates.length === 0) {
      return [];
    }

    const pipeline = await this.getPipeline();
    const inputs = candidates.map((candidate) => ({
      text: query,
      text_pair: candidate.text,
    }));
    const output = await pipeline(inputs);
    const scores = normalizeScores(output, candidates.length);

    const ranked: RankedCandidate[] = candidates.map((candidate, index) => ({
      chunkId: candidate.chunkId,
      score: scores[index],
    }));

    ranked.sort((left, right) => right.score - left.score);
    return ranked;
  }

  private async getPipeline(): Promise<Pipeline> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = this.pipelineFactory(defaultTask, this.modelId);
    }

    return this.pipelinePromise;
  }
}

function createDefaultPipelineFactory(): PipelineFactory {
  return async (task, modelId) => {
    const { pipeline } = await import("@xenova/transformers");
    const factory = pipeline as unknown as (
      pipelineTask: string,
      pipelineModelId: string,
    ) => Promise<Pipeline>;
    return factory(task, modelId);
  };
}

function normalizeScores(output: unknown, expectedCount: number): number[] {
  let results = Array.isArray(output) ? output : [output];

  if (results.length === 1 && Array.isArray(results[0])) {
    results = results[0] as unknown[];
  }

  if (results.length !== expectedCount) {
    throw new Error("Unexpected reranker output length");
  }

  return results.map(extractScore);
}

function extractScore(entry: unknown): number {
  if (typeof entry === "number") {
    return entry;
  }

  if (Array.isArray(entry)) {
    const scores = entry.map(extractScore);
    return Math.max(...scores);
  }

  if (entry && typeof entry === "object") {
    if ("score" in entry && typeof entry.score === "number") {
      return entry.score;
    }
    if ("scores" in entry && Array.isArray(entry.scores)) {
      const scores = entry.scores.map(extractScore);
      return Math.max(...scores);
    }
  }

  throw new Error("Unable to extract score from reranker output");
}
