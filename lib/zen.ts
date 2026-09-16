/**
 * Minimal client for the OpenCode Zen Responses API.
 *
 * Verified against https://opencode.ai/docs/zen/ : Zen exposes an
 * OpenAI-compatible Responses endpoint at
 * https://opencode.ai/zen/v1/responses (auth: Bearer API key), so requests
 * use the Responses shape (`model` + `input`, optional
 * `text.format.json_schema` for strict structured output).
 *
 * Server/script use only — never import from client components, and never
 * accept the key from anywhere except the OPENCODE_API_KEY environment
 * variable (see scripts/generate-daily-game.ts).
 */

export const ZEN_RESPONSES_URL = "https://opencode.ai/zen/v1/responses";
export const DEFAULT_MODEL = "muse-spark-1.3-contributor-free";

export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
}

export interface ZenRequest {
  apiKey: string;
  model: string;
  /** Plain-text instruction / prompt. */
  input: string;
  /** When given, requests strict JSON-schema structured output. */
  jsonSchema?: JsonSchemaSpec;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export type FetchFn = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export class ZenApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ZenApiError";
    this.status = status;
  }
}

/** Real network fetch adapted to the injectable FetchFn shape. */
export const defaultFetch: FetchFn = (url, init) =>
  fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: init.signal,
  }).then(async (res) => ({
    ok: res.ok,
    status: res.status,
    text: () => res.text(),
  }));

/**
 * Pull assistant text out of a Responses payload, tolerating shape drift.
 * Prefers `output_text`, then walks `output[].content[]`, then falls back
 * to a chat-completions-shaped body just in case the gateway varies.
 */
export function extractResponseText(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.output_text === "string" && b.output_text.trim()) {
    return b.output_text;
  }
  const out = b.output;
  if (Array.isArray(out)) {
    const parts: string[] = [];
    for (const item of out) {
      if (typeof item !== "object" || item === null) continue;
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (typeof c !== "object" || c === null) continue;
        const t = (c as Record<string, unknown>).text;
        if (typeof t === "string" && t.trim()) parts.push(t);
      }
    }
    if (parts.length > 0) return parts.join("\n");
  }
  const choices = b.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const msg = first.message as Record<string, unknown> | undefined;
    const content = msg?.content ?? first.text;
    if (typeof content === "string" && content.trim()) return content;
  }
  return null;
}

/** Strip ```json … ``` fences models love to add, despite instructions. */
export function stripCodeFences(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (m ? m[1] : s).trim();
}

export function safeParseJson(s: string): unknown {
  const cleaned = stripCodeFences(s);
  const start = cleaned.search(/[{[]/);
  const trimmed = start > 0 ? cleaned.slice(start) : cleaned;
  return JSON.parse(trimmed);
}

/** One request to the Zen Responses API. Retries live one layer up. */
export async function requestZenText(
  req: ZenRequest,
  fetchFn: FetchFn = defaultFetch
): Promise<string> {
  if (!req.apiKey) throw new ZenApiError(0, "Missing OpenCode API key.");
  const body: Record<string, unknown> = {
    model: req.model,
    input: req.input,
  };
  if (req.jsonSchema) {
    body.text = {
      format: {
        type: "json_schema",
        name: req.jsonSchema.name,
        strict: true,
        schema: req.jsonSchema.schema,
      },
    };
  }
  if (req.maxOutputTokens) body.max_output_tokens = req.maxOutputTokens;

  let res;
  try {
    res = await fetchFn(ZEN_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });
  } catch (e) {
    throw new ZenApiError(0, `Network error calling OpenCode Zen: ${(e as Error).message}`);
  }
  const raw = await res.text();
  if (!res.ok) {
    throw new ZenApiError(res.status, `OpenCode Zen HTTP ${res.status}: ${raw.slice(0, 300)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ZenApiError(res.status, "OpenCode Zen returned non-JSON.");
  }
  const text = extractResponseText(parsed);
  if (!text) throw new ZenApiError(res.status, "OpenCode Zen returned no text output.");
  return text;
}
