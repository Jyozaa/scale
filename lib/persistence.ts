"use client";

/** Local persistence, isolated from UI. All state survives refresh. */

export interface QuestionAttempt {
  guess: number;
  raw: string;
  revealed: boolean;
  factor: number;
}

export interface GameRecord {
  attempts: Record<number, QuestionAttempt>;
  /**
   * Which screen is showing: 0–2 = question index, 3 = daily results.
   * Only advances when the player presses Continue — never on submit —
   * so a refresh always restores the exact screen, including reveals.
   */
  stage: number;
  completed: boolean;
  overall: number | null;
  completedAt?: string;
}

export interface SubmitRecord {
  question: string;
  answer: string;
  unit: string;
  reasoning: string;
  source: string;
  name: string;
  at: string;
}

interface Store {
  games: Record<string, GameRecord>;
  submissions: SubmitRecord[];
}

const KEY = "scale:v1";

function emptyStore(): Store {
  return { games: {}, submissions: [] };
}

function blankRecord(): GameRecord {
  return { attempts: {}, stage: 0, completed: false, overall: null };
}

function readStore(): Store {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || typeof parsed !== "object") return emptyStore();
    return { games: parsed.games ?? {}, submissions: parsed.submissions ?? [] };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // storage full or unavailable — game still works in memory
  }
}

export function getGameRecord(gameId: string): GameRecord | null {
  const store = readStore();
  return store.games[gameId] ?? null;
}

export function saveAttempt(
  gameId: string,
  index: number,
  attempt: QuestionAttempt
): void {
  const store = readStore();
  const rec = store.games[gameId] ?? blankRecord();
  rec.attempts[index] = attempt;
  store.games[gameId] = rec;
  writeStore(store);
}

export function saveStage(gameId: string, stage: number): void {
  const store = readStore();
  const rec = store.games[gameId] ?? blankRecord();
  rec.stage = Math.max(0, Math.min(3, Math.floor(stage)));
  store.games[gameId] = rec;
  writeStore(store);
}

export function completeGame(gameId: string, overall: number): void {
  const store = readStore();
  const rec = store.games[gameId] ?? blankRecord();
  rec.completed = true;
  rec.overall = overall;
  rec.completedAt = new Date().toISOString();
  store.games[gameId] = rec;
  writeStore(store);
}

export function getCompletedMap(): Record<string, GameRecord> {
  return readStore().games;
}

export function saveSubmission(s: Omit<SubmitRecord, "at">): void {
  const store = readStore();
  store.submissions.push({ ...s, at: new Date().toISOString() });
  writeStore(store);
}
