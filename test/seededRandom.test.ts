import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashSeed, mulberry32, normalSample } from "../lib/seededRandom";

describe("hashSeed", () => {
  it("is deterministic and distinguishes strings", () => {
    assert.equal(hashSeed("scale-game-42"), hashSeed("scale-game-42"));
    assert.notEqual(hashSeed("scale-game-42"), hashSeed("scale-game-43"));
  });
});

describe("mulberry32", () => {
  it("replays the same sequence per seed", () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    for (let i = 0; i < 10; i++) assert.equal(a(), b());
  });
  it("stays in [0, 1)", () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 200; i++) {
      const v = rng();
      assert.ok(v >= 0 && v < 1);
    }
  });
});

describe("normalSample", () => {
  it("is deterministic for a seeded rng and roughly centered", () => {
    const r1 = mulberry32(7);
    const r2 = mulberry32(7);
    assert.equal(normalSample(r1), normalSample(r2));
    const rng = mulberry32(2026);
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) sum += normalSample(rng);
    assert.ok(Math.abs(sum / n) < 0.1);
  });
});
