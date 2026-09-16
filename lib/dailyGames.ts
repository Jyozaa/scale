/**
 * Generated daily games: schema types, repository storage, and loading.
 *
 * Source of truth for a day's game is `data/games/YYYY-MM-DD.json`,
 * committed to the repo by the daily generation workflow. The app reads
 * through getDailyGame()/getGameById() — file first, bundled pool as the
 * compatibility fallback for dates with no generated file.
 *
 * Server/script use only (node:fs). Never import from client components:
 * UI receives plain DailyGame objects as props.
 */

import fs from "node:fs";
import path from "node:path";
import {
  dateForNumber,
  formatDateLabel,
  gameForNumber,
  numberForDate,
  padId,
  QUESTION_POOL,
  type DailyGame,
} from "./puzzles";
import { validateQuestions } from "./genValidate";

export { numberForDate };

export const GAMES_DIRNAME = path.join("data", "games");
export const GAME_FILE_VERSION = 1;

export interface GeneratedQuestion {
  id: string;
  category: string;
  prompt: string;
  answer: number;
  unit: string;
  reasoning: string[];
  difficulty: number;
}

export type GenerationMode = "llm" | "fallback";

export interface GeneratedGameFile {
  version: 1;
  date: string;
  gameNumber: number;
  generatedAt: string;
  model: string;
  generationMode: GenerationMode;
  questions: GeneratedQuestion[];
}

export function gamesDir(baseDir: string = process.cwd()): string {
  return path.join(baseDir, GAMES_DIRNAME);
}

export function gameFilePath(dateISO: string, baseDir: string = process.cwd()): string {
  return path.join(gamesDir(baseDir), `${dateISO}.json`);
}

export function isValidDateISO(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/** Runtime check of a parsed game file. Rejects anything malformed. */
export function validateGameFileJSON(value: unknown): {
  ok: boolean;
  errors: string[];
  game?: GeneratedGameFile;
} {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, errors: ["Game file must be a JSON object."] };
  }
  const v = value as Record<string, unknown>;
  if (v.version !== GAME_FILE_VERSION) {
    errors.push(`Unsupported game file version (expected ${GAME_FILE_VERSION}).`);
  }
  if (typeof v.date !== "string" || !isValidDateISO(v.date)) {
    errors.push("Game file needs a valid ISO date.");
  }
  const date = typeof v.date === "string" ? v.date : "";
  if (typeof v.gameNumber !== "number" || !Number.isInteger(v.gameNumber) || v.gameNumber < 1) {
    errors.push("Game file needs a positive integer gameNumber.");
  } else if (date && isValidDateISO(date) && v.gameNumber !== numberForDate(date)) {
    errors.push(
      `gameNumber ${v.gameNumber} does not match date ${date} (expected ${numberForDate(date)}).`
    );
  }
  if (typeof v.generatedAt !== "string" || Number.isNaN(Date.parse(v.generatedAt))) {
    errors.push("Game file needs an ISO generatedAt timestamp.");
  }
  if (typeof v.model !== "string" || v.model.trim().length === 0) {
    errors.push("Game file needs a model name.");
  }
  if (v.generationMode !== "llm" && v.generationMode !== "fallback") {
    errors.push('Game file generationMode must be "llm" or "fallback".');
  }
  const qres = validateQuestions(v.questions, []);
  if (!qres.ok) errors.push(...qres.errors.map((e) => `questions: ${e}`));
  if (errors.length > 0) return { ok: false, errors };

  const questions = (qres.questions ?? []).map((q, i) => ({
    ...q,
    id: `${date}-0${i + 1}`,
  }));
  return {
    ok: true,
    errors,
    game: {
      version: 1,
      date,
      gameNumber: v.gameNumber as number,
      generatedAt: v.generatedAt as string,
      model: (v.model as string).trim(),
      generationMode: v.generationMode as GenerationMode,
      questions,
    },
  };
}

/** Shape the UI already understands. reasoning[] joins into explanation. */
export function generatedFileToDailyGame(file: GeneratedGameFile): DailyGame {
  return {
    id: padId(file.gameNumber),
    number: file.gameNumber,
    date: file.date,
    dateLabel: formatDateLabel(file.date),
    questions: file.questions.map((q) => ({
      id: q.id,
      category: q.category,
      difficulty: q.difficulty,
      prompt: q.prompt,
      answer: q.answer,
      unit: q.unit,
      explanation: q.reasoning.join(" "),
    })),
  };
}

/** Load + validate one generated file. Null when missing or invalid. */
export function loadGameFile(
  dateISO: string,
  baseDir: string = process.cwd()
): GeneratedGameFile | null {
  let raw: string;
  try {
    raw = fs.readFileSync(gameFilePath(dateISO, baseDir), "utf8");
  } catch {
    return null;
  }
  try {
    const res = validateGameFileJSON(JSON.parse(raw));
    return res.ok && res.game ? res.game : null;
  } catch {
    return null;
  }
}

/**
 * Primary question source for the app: today's saved game.
 * Falls back to the bundled pool game for dates with no generated file
 * (pre-generation archive dates included), so Scale never has no game.
 */
export function getDailyGame(dateISO: string, baseDir: string = process.cwd()): DailyGame {
  const file = loadGameFile(dateISO, baseDir);
  if (file) return generatedFileToDailyGame(file);
  return gameForNumber(numberForDate(dateISO));
}

/** Archive lookup by zero-padded id: generated file first, pool second. */
export function getGameById(id: string, baseDir: string = process.cwd()): DailyGame | null {
  if (!/^\d+$/.test(id)) return null;
  const n = parseInt(id, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  const file = loadGameFile(dateForNumber(n), baseDir);
  if (file && file.gameNumber === n) return generatedFileToDailyGame(file);
  return gameForNumber(n);
}

/** Prompts from generated files in the N days before targetDate (newest first). */
export function collectRecentPrompts(
  targetDateISO: string,
  days: number = 90,
  baseDir: string = process.cwd()
): string[] {
  const out: string[] = [];
  const target = new Date(`${targetDateISO}T00:00:00Z`).getTime();
  if (!Number.isFinite(target)) return out;
  for (let back = 1; back <= days; back++) {
    const d = new Date(target - back * 86400000).toISOString().slice(0, 10);
    const file = loadGameFile(d, baseDir);
    if (file) {
      for (const q of file.questions) out.push(q.prompt);
    }
  }
  return out;
}

const FALLBACK_CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/planet|solar|star|galax|sunlight|moon|space|astronaut/i, "space"],
  [/railway|train|flight|airport|heathrow|marathon|runner|bicycle|ship|car|road/i, "transport"],
  [/coffee|tea|calorie|big mac|food|drink|cup|meal|pizza/i, "food"],
  [/city|tokyo|greece|countr|africa|librar|empire|island|people|population|visit|tower/i, "geography"],
  [/heart|beat|bone|body|blood|step|human|brain|language|word|calorie/i, "people"],
  [/youtube|video|sms|letter|computer|software|internet|phone|message/i, "technology"],
  [/tree|ant|ocean|earth|climate|water|forest|animal|whale/i, "nature"],
  [/second|year|minute|mount|everest|kilometre|metre|wall of china/i, "geography"],
];

function guessCategory(prompt: string): string {
  for (const [re, cat] of FALLBACK_CATEGORY_HINTS) {
    if (re.test(prompt)) return cat;
  }
  return "everyday life";
}

function splitReasoning(explanation: string): string[] {
  const steps = explanation
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return steps.length > 0 ? steps.slice(0, 4) : [explanation.trim()];
}

/**
 * Emergency game built from the bundled pool (deterministic per date).
 * Same three questions the legacy system dealt for this date, repackaged
 * as a game file with generationMode "fallback".
 */
export function fallbackGameForDate(dateISO: string, model: string): GeneratedGameFile {
  const n = numberForDate(dateISO);
  const poolGame = gameForNumber(n);
  return {
    version: 1,
    date: dateISO,
    gameNumber: n,
    generatedAt: new Date().toISOString(),
    model,
    generationMode: "fallback",
    questions: poolGame.questions.map((q, i) => ({
      id: `${dateISO}-0${i + 1}`,
      category: guessCategory(q.prompt),
      prompt: q.prompt,
      answer: q.answer,
      unit: q.unit,
      reasoning: splitReasoning(q.explanation),
      difficulty: 2,
    })),
  };
}

/** All bundled pool prompts — fed to the model as extra avoid-list context. */
export function poolPrompts(): string[] {
  return QUESTION_POOL.map((q) => q.prompt);
}

/**
 * Persist a game file. Returns "written", or "exists" when the file is
 * already there and force is not set (never silently overwrite a live game).
 */
export function saveGameFile(
  game: GeneratedGameFile,
  opts: { baseDir?: string; force?: boolean } = {}
): "written" | "exists" {
  const dir = gamesDir(opts.baseDir ?? process.cwd());
  const file = gameFilePath(game.date, opts.baseDir ?? process.cwd());
  if (fs.existsSync(file) && !opts.force) return "exists";
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(game, null, 2)}\n`, "utf8");
  return "written";
}
