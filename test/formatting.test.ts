import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCompact, formatFull, parseEstimate } from "../lib/formatting";

describe("parseEstimate", () => {
  it("parses plain numbers", () => {
    assert.equal(parseEstimate("1200").value, 1200);
    assert.equal(parseEstimate("  42 ").value, 42);
    assert.equal(parseEstimate("3.5").value, 3.5);
  });
  it("parses thousands separators", () => {
    assert.equal(parseEstimate("1,200").value, 1200);
    assert.equal(parseEstimate("1,200,000").value, 1200000);
  });
  it("parses k/m/b/t shorthand", () => {
    assert.equal(parseEstimate("1.2k").value, 1200);
    assert.equal(parseEstimate("2.4m").value, 2400000);
    assert.equal(parseEstimate("3b").value, 3000000000);
    assert.equal(parseEstimate("1T").value, 1000000000000);
    assert.equal(parseEstimate("2M").value, 2000000);
  });
  it("rejects blank, zero, negative and malformed input", () => {
    for (const bad of ["", "   ", "0", "-5", "abc", "1.2.3", "12x", "--4"]) {
      const r = parseEstimate(bad);
      assert.equal(r.ok, false, JSON.stringify(bad));
      assert.ok(r.error, JSON.stringify(bad));
    }
  });
  it("rejects absurd values", () => {
    assert.equal(parseEstimate("99999999999999999999999").ok, false);
  });
});

describe("formatFull", () => {
  it("groups thousands", () => {
    assert.equal(formatFull(6000000), "6,000,000");
    assert.equal(formatFull(7500), "7,500");
  });
});

describe("formatCompact", () => {
  it("compacts large numbers", () => {
    assert.equal(formatCompact(6000000), "6M");
    assert.equal(formatCompact(23000000), "23M");
    assert.equal(formatCompact(1500), "1.5k");
  });
  it("stays readable into the quadrillions", () => {
    assert.equal(formatCompact(20000000000000000), "20Q");
    assert.equal(formatCompact(3000000000000), "3T");
  });
});
