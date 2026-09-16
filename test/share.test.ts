import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildShareText } from "../lib/share";

describe("share text", () => {
  it("builds the compact result format", () => {
    const text = buildShareText(
      42,
      2.14,
      [
        { factor: 1.4, high: true, exact: false },
        { factor: 2.1, high: false, exact: false },
        { factor: 3.2, high: true, exact: false },
      ]
    );
    const expected = [
      "Scale #042",
      "2.14×",
      "",
      "01  ↑ 1.4×",
      "02  ↓ 2.1×",
      "03  ↑ 3.2×",
      "",
      "https://scale.game",
    ].join("\n");
    assert.equal(text, expected);
  });
  it("marks exact guesses with =", () => {
    const text = buildShareText(7, 1, [{ factor: 1, high: false, exact: true }]);
    assert.ok(text.includes("01  = 1×"));
  });
});
