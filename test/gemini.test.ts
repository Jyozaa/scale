import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MODEL,
  REQUEST_TIMEOUT_MS,
  extractResponseText,
  requestGeminiText,
  safeParseJson,
  stripCodeFences,
  GeminiApiError,
  type GenerateFn,
} from "../lib/gemini";
import { QUESTIONS_JSON_SCHEMA } from "../lib/genPrompts";

describe("gemini client", () => {
  it("defaults to gemini-3.5-flash-lite", () => {
    assert.equal(DEFAULT_MODEL, "gemini-3.5-flash-lite");
    assert.ok(REQUEST_TIMEOUT_MS >= 40000 && REQUEST_TIMEOUT_MS <= 60000);
  });
  it("sends the prompt with application/json structured output", async () => {
    let seen: Parameters<GenerateFn>[0] | undefined;
    const generateFn: GenerateFn = async (params) => {
      seen = params;
      return { text: '{"questions": []}' };
    };
    const text = await requestGeminiText(
      { apiKey: "test-key", model: DEFAULT_MODEL, input: "hi", jsonSchema: QUESTIONS_JSON_SCHEMA },
      generateFn
    );
    assert.equal(text, '{"questions": []}');
    assert.equal(seen?.model, "gemini-3.5-flash-lite");
    assert.equal(seen?.contents, "hi");
    assert.equal(seen?.config.responseMimeType, "application/json");
    assert.deepEqual(seen?.config.responseJsonSchema, QUESTIONS_JSON_SCHEMA.schema);
    assert.ok(seen?.config.abortSignal instanceof AbortSignal);
  });
  it("refuses to call without a key", async () => {
    let called = false;
    const generateFn: GenerateFn = async () => {
      called = true;
      return { text: "{}" };
    };
    await assert.rejects(
      requestGeminiText({ apiKey: "", model: DEFAULT_MODEL, input: "hi" }, generateFn),
      GeminiApiError
    );
    assert.equal(called, false);
  });
  it("surfaces API errors with status and without leaking the key", async () => {
    const generateFn: GenerateFn = async () => {
      throw new GeminiApiError(500, "internal error");
    };
    const err = await requestGeminiText(
      { apiKey: "super-secret-key", model: DEFAULT_MODEL, input: "hi" },
      generateFn
    ).then(
      () => null,
      (e: unknown) => e as GeminiApiError
    );
    assert.ok(err instanceof GeminiApiError);
    assert.equal(err.status, 500);
    assert.ok(!err.message.includes("super-secret-key"));
  });
  it("maps SDK-style errors to typed errors with status", async () => {
    const sdkError = Object.assign(new Error("quota exhausted for today"), { status: 429 });
    const generateFn: GenerateFn = async () => {
      throw sdkError;
    };
    const err = await requestGeminiText(
      { apiKey: "k", model: DEFAULT_MODEL, input: "hi" },
      generateFn
    ).then(
      () => null,
      (e: unknown) => e as GeminiApiError
    );
    assert.ok(err instanceof GeminiApiError);
    assert.equal(err.status, 429);
    assert.equal(err.isQuotaError, true);
  });
  it("treats a hanging request as a timeout (retryable, concise, no stack)", async () => {
    const generateFn: GenerateFn = (_params) =>
      new Promise((resolve, reject) => {
        _params.config.abortSignal?.addEventListener("abort", () =>
          reject(new Error("This operation was aborted"))
        );
      });
    const err = await requestGeminiText(
      { apiKey: "k", model: DEFAULT_MODEL, input: "hi", timeoutMs: 20 },
      generateFn
    ).then(
      () => null,
      (e: unknown) => e as GeminiApiError
    );
    assert.ok(err instanceof GeminiApiError);
    assert.equal(err.status, 0);
    assert.match(err.message, /timed out/);
  });
  it("extracts text from Gemini response shapes", () => {
    assert.equal(extractResponseText({ text: "c" }), "c");
    assert.equal(
      extractResponseText({ candidates: [{ content: { parts: [{ text: "a" }, { text: "b" }] } }] }),
      "a\nb"
    );
    assert.equal(extractResponseText({ candidates: [] }), null);
    assert.equal(extractResponseText({}), null);
    assert.equal(extractResponseText(null), null);
  });
  it("strips fences and parses JSON", () => {
    assert.deepEqual(safeParseJson('```json\n{"a": 1}\n```'), { a: 1 });
    assert.deepEqual(safeParseJson('note:\n{"a": 2}'), { a: 2 });
    assert.throws(() => safeParseJson("no json here {{{"));
    assert.equal(stripCodeFences("plain"), "plain");
  });
});
