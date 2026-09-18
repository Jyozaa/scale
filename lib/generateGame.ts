/**
 * Two-pass daily generation orchestration (pure logic, no fs/env).
 *
 * Pass 1 (generator) produces 3 candidates; pass 2 (critic) audits and
 * corrects them. The network call is injected (`requestText`) so tests mock
 * it and the real script passes the Gemini client. Retries are bounded:
 * GENERATOR_ATTEMPTS generator tries, then CRITIC_ATTEMPTS critic tries.
 * Anything left failing throws GenerationFailedError and the caller falls
 * back to the bundled pool (see fallbackGameForDate).
 */

import {
  buildCriticPrompt,
  buildGeneratorPrompt,
  QUESTIONS_JSON_SCHEMA,
} from "./genPrompts";
import { validateQuestions, type CandidateQuestion } from "./genValidate";
import { safeParseJson } from "./gemini";

export const GENERATOR_ATTEMPTS = 3;
export const CRITIC_ATTEMPTS = 2;

export class GenerationFailedError extends Error {
  attempts: number;
  constructor(message: string, attempts: number) {
    super(message);
    this.name = "GenerationFailedError";
    this.attempts = attempts;
  }
}

/** (kind, prompt) => raw model text. "generate" or "critic". */
export type RequestTextFn = (kind: "generate" | "critic", prompt: string) => Promise<string>;

export interface GenerateOpts {
  dateISO: string;
  gameNumber: number;
  recentPrompts: string[];
  poolPrompts: string[];
  requestText: RequestTextFn;
}

export interface GenerateResult {
  questions: CandidateQuestion[];
  generatorAttempts: number;
  criticAttempts: number;
  warnings: string[];
}

function extractQuestionsArray(parsed: unknown): unknown {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    Array.isArray((parsed as Record<string, unknown>).questions)
  ) {
    return (parsed as Record<string, unknown>).questions;
  }
  if (Array.isArray(parsed)) return parsed;
  throw new Error("Model output has no questions array.");
}

async function runGenerator(opts: GenerateOpts): Promise<{
  questions: CandidateQuestion[];
  attempts: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= GENERATOR_ATTEMPTS; attempt++) {
    const prompt = buildGeneratorPrompt({
      dateISO: opts.dateISO,
      gameNumber: opts.gameNumber,
      recentPrompts: opts.recentPrompts,
      poolPrompts: opts.poolPrompts,
      retryNote:
        attempt > 1
          ? `Your previous attempt failed validation: ${lastError} Fix ONLY the reported problems; keep the rest of the format identical.`
          : undefined,
    });
    let raw: string;
    try {
      raw = await opts.requestText("generate", prompt);
    } catch (e) {
      lastError = `API request failed: ${(e as Error).message}`;
      continue;
    }
    let parsed: unknown;
    try {
      parsed = safeParseJson(raw);
    } catch {
      lastError = "output was not valid JSON.";
      continue;
    }
    let arr: unknown;
    try {
      arr = extractQuestionsArray(parsed);
    } catch {
      lastError = "output has no questions array.";
      continue;
    }
    const res = validateQuestions(arr, opts.recentPrompts);
    warnings.push(...res.warnings);
    if (res.ok && res.questions) {
      return { questions: res.questions, attempts: attempt, warnings };
    }
    lastError = res.errors.join(" ");
  }
  throw new GenerationFailedError(
    `Generator failed after ${GENERATOR_ATTEMPTS} attempts. Last error: ${lastError}`,
    GENERATOR_ATTEMPTS
  );
}

async function runCritic(
  opts: GenerateOpts,
  candidates: CandidateQuestion[]
): Promise<{ questions: CandidateQuestion[]; attempts: number; warnings: string[] }> {
  const warnings: string[] = [];
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= CRITIC_ATTEMPTS; attempt++) {
    const prompt = buildCriticPrompt({
      dateISO: opts.dateISO,
      candidatesJson: JSON.stringify({ questions: candidates }),
    });
    let raw: string;
    try {
      raw = await opts.requestText("critic", prompt);
    } catch (e) {
      lastError = `API request failed: ${(e as Error).message}`;
      continue;
    }
    let parsed: unknown;
    try {
      parsed = safeParseJson(raw);
    } catch {
      lastError = "critic output was not valid JSON.";
      continue;
    }
    let arr: unknown;
    try {
      arr = extractQuestionsArray(parsed);
    } catch {
      lastError = "critic output has no questions array.";
      continue;
    }
    // The critic's final word is checked against the same bar, including
    // recency (a critic "correction" must not reintroduce a duplicate).
    const res = validateQuestions(arr, opts.recentPrompts);
    warnings.push(...res.warnings);
    if (res.ok && res.questions) {
      return { questions: res.questions, attempts: attempt, warnings };
    }
    lastError = res.errors.join(" ");
  }
  throw new GenerationFailedError(
    `Critic failed after ${CRITIC_ATTEMPTS} attempts. Last error: ${lastError}`,
    GENERATOR_ATTEMPTS + CRITIC_ATTEMPTS
  );
}

/**
 * Run both passes. Resolves with final questions or throws
 * GenerationFailedError (caller: use the pool fallback).
 */
export async function generateDailyQuestions(opts: GenerateOpts): Promise<GenerateResult> {
  const gen = await runGenerator(opts);
  const critic = await runCritic(opts, gen.questions);
  return {
    questions: critic.questions,
    generatorAttempts: gen.attempts,
    criticAttempts: critic.attempts,
    warnings: [...gen.warnings, ...critic.warnings],
  };
}

export { QUESTIONS_JSON_SCHEMA };
