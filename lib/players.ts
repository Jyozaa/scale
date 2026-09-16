import { mulberry32, hashSeed, normalSample } from "./seededRandom";
import { overallScore, scoreFactor } from "./scoring";

/**
 * Synthetic "other estimators" — deterministic per game + question.
 * Log-normal guesses around the true answer (sigma ~0.7 orders).
 * Never regenerated per render: pure function of ids.
 */

export interface PlayerSim {
  percentile: number; // 0–100, share of synthetic players you beat
  medianFactor: number;
  sampleCount: number;
}

export function syntheticOverallScores(
  gameId: string,
  answers: number[],
  count = 600
): number[] {
  const scores: number[] = [];
  for (let p = 0; p < count; p++) {
    const factors = answers.map((answer, qi) => {
      const rng = mulberry32(hashSeed(`scale-${gameId}-q${qi}-p${p}`));
      const z = normalSample(rng);
      const guess = answer * Math.pow(10, z * 0.7);
      return scoreFactor(guess, answer);
    });
    scores.push(overallScore(factors));
  }
  return scores.sort((a, b) => a - b);
}

export function playerComparison(
  gameId: string,
  answers: number[],
  userOverall: number
): PlayerSim {
  const scores = syntheticOverallScores(gameId, answers);
  const beaten = scores.filter((s) => s >= userOverall).length;
  const mid = scores[Math.floor(scores.length / 2)];
  return {
    percentile: Math.round((beaten / scores.length) * 100),
    medianFactor: mid,
    sampleCount: scores.length,
  };
}

