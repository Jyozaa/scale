import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { playerComparison, syntheticOverallScores } from "../lib/players";

const ANSWERS = [7500, 140, 100000];

describe("synthetic players", () => {
  it("produces a sorted, deterministic field", () => {
    const run = () => syntheticOverallScores("042", ANSWERS);
    const scores = run();
    assert.equal(scores.length, 600);
    assert.deepEqual(scores, run());
    for (let i = 1; i < scores.length; i++) assert.ok(scores[i] >= scores[i - 1]);
    for (const s of scores) assert.ok(s >= 1 && Number.isFinite(s));
  });
  it("ranks a perfect score at the top and a wild one near the bottom", () => {
    const perfect = playerComparison("042", ANSWERS, 1);
    assert.equal(perfect.percentile, 100);
    const wild = playerComparison("042", ANSWERS, 1e9);
    assert.ok(wild.percentile < 50);
    assert.ok(wild.medianFactor >= 1);
    assert.equal(wild.sampleCount, 600);
  });
});
