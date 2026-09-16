import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  directionOf,
  formatFactor,
  overallScore,
  scoreFactor,
} from "../lib/scoring";

describe("scoreFactor", () => {
  it("scores a perfect estimate as 1", () => {
    assert.equal(scoreFactor(100, 100), 1);
  });
  it("is symmetric for high and low", () => {
    assert.equal(scoreFactor(200, 100), 2);
    assert.equal(scoreFactor(50, 100), 2);
  });
  it("handles decimals and large magnitudes", () => {
    assert.equal(scoreFactor(10, 100), 10);
    assert.equal(scoreFactor(1e12, 1e9), 1000);
  });
  it("rejects zero and invalid input", () => {
    assert.ok(Number.isNaN(scoreFactor(0, 100)));
    assert.ok(Number.isNaN(scoreFactor(100, 0)));
    assert.ok(Number.isNaN(scoreFactor(NaN, 100)));
    assert.ok(Number.isNaN(scoreFactor(-5, 100)));
  });
});

describe("overallScore", () => {
  it("is the geometric mean of the factors", () => {
    assert.equal(overallScore([1, 1, 1]), 1);
    // Math.pow with a fractional exponent is approximate — compare loosely.
    assert.ok(Math.abs(overallScore([2, 2, 2]) - 2) < 1e-9);
    // (1 * 2 * 8)^(1/3) = 16^(1/3)
    assert.ok(Math.abs(overallScore([1, 2, 8]) - Math.cbrt(16)) < 1e-9);
  });
  it("punishes one wild guess more than an arithmetic mean would forgive", () => {
    const geo = overallScore([1, 1, 27]);
    assert.ok(Math.abs(geo - 3) < 1e-9);
    assert.ok(geo < (1 + 1 + 27) / 3);
  });
  it("rejects empty and invalid input", () => {
    assert.ok(Number.isNaN(overallScore([])));
    assert.ok(Number.isNaN(overallScore([1, NaN, 1])));
  });
});

describe("directionOf", () => {
  it("labels high, low and exact", () => {
    assert.equal(directionOf(200, 100), "high");
    assert.equal(directionOf(50, 100), "low");
    assert.equal(directionOf(100, 100), "exact");
  });
});

describe("formatFactor", () => {
  it("formats small factors with decimals", () => {
    assert.equal(formatFactor(1), "1×");
    assert.equal(formatFactor(2.5), "2.5×");
    assert.equal(formatFactor(1.24), "1.24×");
  });
  it("rounds large factors", () => {
    assert.equal(formatFactor(14.2), "14.2×");
    assert.equal(formatFactor(1400), "1,400×");
  });
});
