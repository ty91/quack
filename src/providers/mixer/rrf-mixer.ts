import type { Mixer, RankedCandidate } from "../types.js";

type RrfMixerOptions = {
  rrfK: number;
};

const defaultOptions: RrfMixerOptions = {
  rrfK: 60,
};

export class RrfMixer implements Mixer {
  private readonly rrfK: number;

  constructor(options: Partial<RrfMixerOptions> = {}) {
    this.rrfK = options.rrfK ?? defaultOptions.rrfK;

    if (this.rrfK <= 0) {
      throw new Error("rrfK must be positive");
    }
  }

  mix(bm25: RankedCandidate[], vector: RankedCandidate[]): RankedCandidate[] {
    const scores = new Map<number, number>();

    applyRrfScores(scores, bm25, this.rrfK);
    applyRrfScores(scores, vector, this.rrfK);

    const results: RankedCandidate[] = [];
    for (const [chunkId, score] of scores.entries()) {
      results.push({ chunkId, score });
    }

    results.sort((left, right) => right.score - left.score);
    return results;
  }
}

function applyRrfScores(
  scores: Map<number, number>,
  candidates: RankedCandidate[],
  rrfK: number,
): void {
  candidates.forEach((candidate, index) => {
    const rank = index + 1;
    const score = 1 / (rrfK + rank);
    const current = scores.get(candidate.chunkId) ?? 0;
    scores.set(candidate.chunkId, current + score);
  });
}
