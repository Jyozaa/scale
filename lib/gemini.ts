/**
 * Minimal client for the Google Gemini API (official `@google/genai` SDK).
 *
 * Docs: https://googleapis.github.io/js-genai/
 * Model: gemini-3.5-flash-lite (see DEFAULT_MODEL).
 *
 * Design notes:
 * - Requests use Gemini structured output (`responseMimeType:
 *   "application/json"` + `responseJsonSchema` from the shared
 *   QUESTIONS_JSON_SCHEMA), but provider-side output is NOT trusted on its
 *   own — everything still goes through `safeParseJson` +
 *   `validateQuestions` runtime validation as the source of truth.
 * - Every request has a hard timeout (default 45s) via AbortController.
 *   Timeouts are reported as status 0 (retryable transient) with a concise
 *   message and no stack trace.
 * - Server/script use only — never import from client components, and never
 *   accept the key from anywhere except the GEMINI_API_KEY environment
 *   variable (see scripts/generate-daily-game.ts). Never use NEXT_PUBLIC_*.
 *   The key is never logged.
 */

import { GoogleGenAI } from "@google/genai";

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** Hard per-request timeout (ms). Never let a provider call hang forever. */
export const REQUEST_TIMEOUT_MS = 45_000;

export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
}

export interface GeminiRequest {
  apiKey: string;
  model: string;
  /** Plain-text instruction / prompt. */
  input: string;
  /** When given, sent as Gemini structured-output `responseJsonSchema`. */
  jsonSchema?: JsonSchemaSpec;
  maxOutputTokens?: number;
  /** Optional caller cancellation. Combined with the internal hard timeout. */
  signal?: AbortSignal;
  /** Override for tests. Defaults to REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
}

/** Minimal shape of the SDK call this client makes (injectable for tests). */
export interface GenerateContentParams {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    responseMimeType: string;
    responseJsonSchema: unknown;
    maxOutputTokens?: number;
    abortSignal?: AbortSignal;
  };
}

export interface GenerateContentResult {
  text?: string | null;
}

export type GenerateFn = (params: GenerateContentParams) => Promise<GenerateContentResult>;

export class GeminiApiError extends Error {
  /**
   * HTTP-like status: 0 = network/timeout/abort/missing key (retryable),
   * 429 = rate limit / quota, 5xx = service error (retryable).
   */
  status: number;
  /**
   * True when the response clearly indicates exhausted quota/billing limits
   * (as opposed to a transient rate limit). Callers should NOT hammer the
   * API in that case — fail fast and let the fallback pool take over.
   */
  isQuotaError: boolean;
  constructor(status: number, message: string, isQuotaError = false) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
    this.isQuotaError = isQuotaError;
  }
}

/** Real SDK call. The key is passed to the SDK only, never logged. */
async function defaultGenerate(apiKey: string, params: GenerateContentParams): Promise<GenerateContentResult> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: params.model,
    contents: params.contents,
    config: {
      systemInstruction: params.config.systemInstruction,
      responseMimeType: params.config.responseMimeType,
      responseJsonSchema: params.config.responseJsonSchema,
      ...(params.config.maxOutputTokens !== undefined
        ? { maxOutputTokens: params.config.maxOutputTokens }
        : {}),
      abortSignal: params.config.abortSignal,
    },
  });
  return response;
}

/**
 * Pull model text out of a generate-content result.
 * Prefers the SDK's `.text` accessor, then walks
 * `candidates[].content.parts[]` so plain test fixtures work too.
 */
export function extractResponseText(resp: unknown): string | null {
  if (typeof resp !== "object" || resp === null) return null;
  try {
    const t = (resp as { text?: unknown }).text;
    if (typeof t === "string" && t.trim()) return t;
  } catch {
    // Fall through to the candidates walk below.
  }
  const candidates = (resp as Record<string, unknown>).candidates;
  if (Array.isArray(candidates)) {
    const parts: string[] = [];
    for (const c of candidates) {
      if (typeof c !== "object" || c === null) continue;
      const content = (c as Record<string, unknown>).content as Record<string, unknown> | undefined;
      const cparts = content?.parts;
      if (!Array.isArray(cparts)) continue;
      for (const p of cparts) {
        if (typeof p !== "object" || p === null) continue;
        const pt = (p as Record<string, unknown>).text;
        if (typeof pt === "string" && pt.trim()) parts.push(pt);
      }
    }
    if (parts.length > 0) return parts.join("\n");
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

/** A 429 clearly caused by exhausted quota/billing (not a transient limit). */
function looksLikeQuotaError(message: string): boolean {
  return /quota|billing|daily/i.test(message);
}

function mapSdkError(e: unknown): GeminiApiError {
  if (e instanceof GeminiApiError) return e;
  const status =
    typeof e === "object" && e !== null && typeof (e as Record<string, unknown>).status === "number"
      ? ((e as Record<string, unknown>).status as number)
      : 0;
  const raw = e instanceof Error ? e.message : String(e);
  const message = raw.slice(0, 300);
  if (status === 0) return new GeminiApiError(0, `Network error calling Gemini: ${message}`);
  if (status === 429) {
    return new GeminiApiError(
      429,
      `Gemini HTTP 429: ${message}`,
      looksLikeQuotaError(message)
    );
  }
  return new GeminiApiError(status, `Gemini HTTP ${status}: ${message}`);
}

/** One request to the Gemini API, with a hard timeout. Retries live one layer up. */
export async function requestGeminiText(
  req: GeminiRequest,
  generateFn?: GenerateFn
): Promise<string> {
  if (!req.apiKey) throw new GeminiApiError(0, "Missing Gemini API key.");
  const timeoutMs = req.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  // Allow the timeout to fire without keeping the process alive on its own.
  if (typeof timer.unref === "function") timer.unref();
  const onCallerAbort = (): void => controller.abort();
  if (req.signal) {
    if (req.signal.aborted) controller.abort();
    else req.signal.addEventListener("abort", onCallerAbort, { once: true });
  }
  try {
    const gen = generateFn ?? ((p: GenerateContentParams) => defaultGenerate(req.apiKey, p));
    const response = await gen({
      model: req.model,
      contents: req.input,
      config: {
        systemInstruction:
          "Return JSON only, no markdown fences, no commentary. Match the exact shape requested by the user message.",
        responseMimeType: "application/json",
        responseJsonSchema: req.jsonSchema?.schema,
        ...(req.maxOutputTokens !== undefined ? { maxOutputTokens: req.maxOutputTokens } : {}),
        abortSignal: controller.signal,
      },
    });
    const text = extractResponseText(response);
    if (!text) throw new GeminiApiError(0, "Gemini returned no text output.");
    return text;
  } catch (e) {
    if (timedOut) throw new GeminiApiError(0, "Gemini request timed out.");
    if (controller.signal.aborted) throw new GeminiApiError(0, "Gemini request aborted.");
    throw mapSdkError(e);
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener("abort", onCallerAbort);
  }
}
