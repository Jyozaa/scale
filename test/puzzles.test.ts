import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  QUESTION_POOL,
  dateForNumber,
  formatDateLabel,
  gameForId,
  gameForNumber,
  numberForDate,
  padId,
} from "../lib/puzzles";

describe("daily games", () => {
  it("always deals exactly 3 distinct, positive-answer questions", () => {
    for (const n of [1, 2, 7, 42, 78, 365]) {
      const g = gameForNumber(n);
      assert.equal(g.questions.length, 3);
      assert.equal(new Set(g.questions.map((q) => q.prompt)).size, 3);
      for (const q of g.questions) {
        assert.ok(q.answer > 0);
        assert.ok(q.unit.length > 0);
        assert.ok(q.explanation.length > 20);
      }
    }
  });
  it("is deterministic: same number, same game", () => {
    assert.deepEqual(gameForNumber(42), gameForNumber(42));
  });
  it("varies between days", () => {
    const sets = new Set(
      Array.from({ length: 8 }, (_, k) =>
        gameForNumber(40 + k)
          .questions.map((q) => q.prompt)
          .join("|")
      )
    );
    assert.ok(sets.size > 1);
  });
  it("round-trips between numbers, ids and dates", () => {
    assert.equal(padId(42), "042");
    assert.equal(numberForDate(dateForNumber(42)), 42);
    assert.equal(gameForId("042")?.number, 42);
    assert.equal(gameForId("nope"), null);
    assert.equal(gameForId("0"), null);
  });
  it("formats date labels", () => {
    assert.equal(formatDateLabel("2026-09-16"), "16 Sep 2026");
  });
  it("pool questions all end with a question mark", () => {
    for (const q of QUESTION_POOL) {
      assert.ok(q.prompt.endsWith("?"), q.prompt);
    }
  });
});
