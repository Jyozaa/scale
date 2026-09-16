import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MODEL,
  ZEN_RESPONSES_URL,
  extractResponseText,
  requestZenText,
  safeParseJson,
  stripCodeFences,
  ZenApiError,
  type FetchFn,
} from "../lib/zen";
import { QUESTIONS_JSON_SCHEMA } from "../lib/genPrompts";

function mockFetch(handler: (url: string, init: Parameters<FetchFn>[1]) => { ok: boolean; status: number; body: string }): FetchFn {
  return async (url, init) => {
    const r = handler(url, init);
    return { ok: r.ok, status: r.status, text: async () => r.body };
  };
}

describe("zen client", () => {
  it("posts to the Responses endpoint with bearer auth + strict schema", async () => {
    const seen: { url?: string; init?: Parameters<FetchFn>[1] } = {};
    const fetchFn = mockFetch((url, init) => {
      seen.url = url;
      seen.init = init;
      return {
        ok: true,
        status: 200,
        body: JSON.stringify({ output_text: '{"questions": []}' }),
      };
    });
    const text = await requestZenText(
      { apiKey: "test-key", model: DEFAULT_MODEL, input: "hi", jsonSchema: QUESTIONS_JSON_SCHEMA },
      fetchFn
    );
    assert.equal(text, '{"questions": []}');
    assert.equal(seen.url, ZEN_RESPONSES_URL);
    assert.equal(seen.init?.method, "POST");
    assert.equal(seen.init?.headers.Authorization, "Bearer test-key");
    const sent = JSON.parse(seen.init?.body ?? "{}");
    assert.equal(sent.model, "muse-spark-1.3-contributor-free");
    assert.equal(sent.text.format.type, "json_schema");
    assert.equal(sent.text.format.strict, true);
  });
  it("refuses to call without a key", async () => {
    let called = false;
    await assert.rejects(
      requestZenText(
        { apiKey: "", model: DEFAULT_MODEL, input: "hi" },
        mockFetch(() => {
          called = true;
          return { ok: true, status: 200, body: "{}" };
        })
      ),
      ZenApiError
    );
    assert.equal(called, false);
  });
  it("surfaces HTTP errors without leaking the key", async () => {
    const err = await requestZenText(
      { apiKey: "super-secret-key", model: DEFAULT_MODEL, input: "hi" },
      mockFetch(() => ({ ok: false, status: 401, body: "bad key" }))
    ).then(
      () => null,
      (e: unknown) => e as ZenApiError
    );
    assert.ok(err instanceof ZenApiError);
    assert.equal(err.status, 401);
    assert.ok(!err.message.includes("super-secret-key"));
  });
  it("extracts text from Responses and chat-like shapes", () => {
    assert.equal(extractResponseText({ output_text: " hello " }), " hello ");
    assert.equal(
      extractResponseText({ output: [{ content: [{ text: "a" }, { text: "b" }] }] }),
      "a\nb"
    );
    assert.equal(
      extractResponseText({ choices: [{ message: { content: "c" } }] }),
      "c"
    );
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
