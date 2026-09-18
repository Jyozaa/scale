#!/usr/bin/env node
/**
 * Scale daily game generator — runs the same logic locally and in CI.
 *
 *   npm run generate:daily                      # generate today's (UTC) game
 *   npm run generate:daily -- --date 2026-09-18 # generate a specific date
 *   npm run generate:daily -- --dry-run         # validate only, write nothing
 *   npm run generate:daily -- --force            # overwrite an existing file
 *
 * Key ONLY from GEMINI_API_KEY env var (exported in the shell or placed
 * in a gitignored .env.local file, which this script loads). Model from
 * GEMINI_MODEL (default gemini-3.5-flash-lite). The key is never logged,
 * never written to files, and never sent anywhere except the Gemini API.
 */

import {
  collectRecentPrompts,
  fallbackGameForDate,
  gameFilePath,
  isValidDateISO,
  loadGameFile,
  poolPrompts,
  saveGameFile,
  type GeneratedGameFile,
} from "../lib/dailyGames";
import { numberForDate } from "../lib/puzzles";
import { QUESTIONS_JSON_SCHEMA, generateDailyQuestions } from "../lib/generateGame";
import { DEFAULT_MODEL, GeminiApiError, requestGeminiText } from "../lib/gemini";
import fs from "node:fs";
import path from "node:path";

/**
 * Small safe local env loader (no new dependencies).
 * Loads `.env.local` then `.env` from the repo root so
 * `npm run generate:daily` works without manual exports.
 * Shell-exported variables always win — files never overwrite them.
 */
function loadLocalEnv(): void {
  const candidates = [".env.local", ".env"];
  for (const name of candidates) {
    let raw: string;
    try {
      raw = fs.readFileSync(path.join(process.cwd(), name), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const eq = trimmed.indexOf("=");
      const key = trimmed.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (process.env[key] !== undefined) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv: string[]): { date: string; force: boolean; dryRun: boolean } {
  let date = utcToday();
  let force = false;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--date" && argv[i + 1]) {
      date = argv[++i];
    } else if (a === "--force") {
      force = true;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: generate:daily [--date YYYY-MM-DD] [--force] [--dry-run]\n" +
          "  --date     game date (default: today, UTC)\n" +
          "  --force    overwrite an existing game file (dev only; CI never uses this)\n" +
          "  --dry-run  generate + validate, print a summary, write nothing"
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a} (see --help)`);
      process.exit(1);
    }
  }
  if (!isValidDateISO(date)) {
    console.error(`Invalid --date (want YYYY-MM-DD): ${date}`);
    process.exit(1);
  }
  return { date, force, dryRun };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Network/5xx/timeout retries with exponential backoff. No infinite loops.
 * Transient rate limits (429) get ONE retry after a longer delay; exhausted
 * quota fails fast so the deterministic fallback pool can take over.
 */
async function requestWithBackoff(
  kind: "generate" | "critic",
  prompt: string,
  apiKey: string,
  model: string,
  log: (m: string) => void
): Promise<string> {
  const delays = [1000, 2000, 4000];
  let rateLimitRetried = false;
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestGeminiText(
        { apiKey, model, input: prompt, jsonSchema: QUESTIONS_JSON_SCHEMA, maxOutputTokens: 3000 },
        undefined
      );
    } catch (e) {
      const err = e as GeminiApiError;
      const transient = err.status === 0 || err.status >= 500;
      if (transient && attempt < delays.length) {
        log(`  [${kind}] request failed (${err.message.slice(0, 120)}), backing off ${delays[attempt]}ms…`);
        await sleep(delays[attempt]);
        continue;
      }
      if (err.status === 429 && !err.isQuotaError && !rateLimitRetried) {
        rateLimitRetried = true;
        log(`  [${kind}] rate limited, waiting 10000ms before one retry…`);
        await sleep(10000);
        continue;
      }
      throw e;
    }
  }
}

function summarize(game: GeneratedGameFile): string {
  const rows = game.questions
    .map((q) => {
      const order = Number.isFinite(q.answer) && q.answer > 0 ? Math.floor(Math.log10(q.answer)) : "?";
      return `  - [${q.category}] (10^${order}, d${q.difficulty}) ${q.prompt} → ${q.answer} ${q.unit}`;
    })
    .join("\n");
  return `Scale #${game.gameNumber} for ${game.date} [mode=${game.generationMode}, model=${game.model}]\n${rows}`;
}

async function main(): Promise<void> {
  const { date, force, dryRun } = parseArgs(process.argv.slice(2));
  const log = (m: string) => console.log(`[generate:daily] ${m}`);
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const gameNumber = numberForDate(date);

  log(`Target: ${date} → Scale #${gameNumber} (model: ${model}${apiKey ? "" : ", NO API KEY"})`);

  if (loadGameFile(date) && !force) {
    log(`Today's game already exists (${gameFilePath(date)}). Nothing to do.`);
    return;
  }
  if (force) log("--force: an existing file will be overwritten.");

  const recent = collectRecentPrompts(date, 90);
  log(`Loaded ${recent.length} recent prompts (90-day window) for duplicate avoidance.`);

  let game: GeneratedGameFile | null = null;

  if (!apiKey) {
    log("GEMINI_API_KEY is not set — skipping LLM generation, using pool fallback.");
  } else {
    try {
      log("Pass 1/2: requesting 3 candidate questions from Gemini…");
      let criticAnnounced = false;
      const res = await generateDailyQuestions({
        dateISO: date,
        gameNumber,
        recentPrompts: recent,
        poolPrompts: poolPrompts(),
        requestText: (kind, prompt) => {
          if (kind === "critic" && !criticAnnounced) {
            criticAnnounced = true;
            log("Pass 2/2: critic reviewing generated questions…");
          }
          return requestWithBackoff(kind, prompt, apiKey, model, log);
        },
      });
      for (const w of res.warnings) log(`warning: ${w}`);
      log(`Pass 2/2 done: critic accepted 3 questions.`);
      game = {
        version: 1,
        date,
        gameNumber,
        generatedAt: new Date().toISOString(),
        model,
        generationMode: "llm",
        questions: res.questions.map((q, i) => ({ ...q, id: `${date}-0${i + 1}` })),
      };
      log("Generation succeeded (mode=llm).");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`Generation failed: ${msg}`);
      log("Falling back to the bundled question pool so the day still has a game.");
    }
  }

  if (!game) {
    game = fallbackGameForDate(date, model);
    log("Fallback active (mode=fallback): game built deterministically from the bundled pool.");
  }

  console.log("---");
  console.log(summarize(game));
  console.log("---");

  if (dryRun) {
    log("--dry-run: NOT writing any file. Done.");
    return;
  }
  const status = saveGameFile(game, { force });
  if (status === "exists") {
    // Raced with another run after our earlier check — keep their file.
    log("Today's game already exists (written by a concurrent run). Keeping it.");
    return;
  }
  log(`Wrote ${gameFilePath(date)}`);
}

main().catch((e) => {
  console.error(`[generate:daily] fatal: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
