import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectRecentPrompts,
  fallbackGameForDate,
  gameFilePath,
  generatedFileToDailyGame,
  getDailyGame,
  getGameById,
  loadGameFile,
  saveGameFile,
  validateGameFileJSON,
  type GeneratedGameFile,
} from "../lib/dailyGames";
import {
  findDuplicate,
  normalizePrompt,
  promptsDuplicate,
  similarity,
  validateQuestions,
  type CandidateQuestion,
} from "../lib/genValidate";
import {
  GenerationFailedError,
  generateDailyQuestions,
} from "../lib/generateGame";
import {
  dateForNumber,
  gameForNumber,
  numberForDate,
  padId,
} from "../lib/puzzles";

function cand(
  prompt: string,
  answer = 1000,
  unit = "widgets",
  category = "space",
  difficulty = 2
): CandidateQuestion {
  return {
    prompt,
    answer,
    unit,
    category,
    reasoning: ["About a thousand of them exist.", "Round to one significant figure."],
    difficulty,
  };
}

function trio(): CandidateQuestion[] {
  return [
    cand("How many craters are on the Moon?", 9000, "craters", "space"),
    cand("How many loaves of bread are baked daily in France?", 32000000, "loaves", "food"),
    cand("How many shipping containers cross the oceans each year?", 800000000, "containers", "transport", 3),
  ];
}

function gameFile(date: string, n: number, mode: "llm" | "fallback" = "llm"): GeneratedGameFile {
  return {
    version: 1,
    date,
    gameNumber: n,
    generatedAt: "2026-09-16T00:05:00.000Z",
    model: "gemini-3.5-flash-lite",
    generationMode: mode,
    questions: trio().map((q, i) => ({ ...q, id: `${date}-0${i + 1}` })),
  };
}

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scale-test-"));
}

describe("game numbers (single central helper)", () => {
  it("maps launch day 2026-07-01 to game #1", () => {
    assert.equal(numberForDate("2026-07-01"), 1);
    assert.equal(dateForNumber(1), "2026-07-01");
  });
  it("round-trips dates, numbers and ids", () => {
    for (const n of [1, 42, 78]) {
      assert.equal(numberForDate(dateForNumber(n)), n);
      assert.equal(padId(n), String(n).padStart(3, "0"));
    }
  });
});

describe("game file schema validation", () => {
  it("accepts a well-formed file", () => {
    const res = validateGameFileJSON(gameFile("2026-09-17", numberForDate("2026-09-17")));
    assert.equal(res.ok, true);
    assert.ok(res.game);
    assert.equal(res.game.questions.length, 3);
  });
  it("rejects wrong version, bad date, and gameNumber mismatch", () => {
    const base = gameFile("2026-09-17", numberForDate("2026-09-17"));
    assert.equal(validateGameFileJSON({ ...base, version: 2 }).ok, false);
    assert.equal(validateGameFileJSON({ ...base, date: "not-a-date" }).ok, false);
    assert.equal(validateGameFileJSON({ ...base, gameNumber: 9999 }).ok, false);
    assert.equal(validateGameFileJSON({ ...base, generationMode: "ouija" }).ok, false);
    assert.equal(validateGameFileJSON(null).ok, false);
    assert.equal(validateGameFileJSON("nope").ok, false);
  });
  it("requires exactly 3 questions", () => {
    const t = trio();
    assert.equal(validateQuestions(t.slice(0, 2)).ok, false);
    assert.equal(validateQuestions([...t, t[0]]).ok, false);
    assert.equal(validateQuestions(t).ok, true);
    assert.equal(validateQuestions({ nope: 1 }).ok, false);
  });
  it("rejects invalid numerical answers", () => {
    const t = trio();
    for (const bad of [0, -5, NaN, Infinity, "1000", null]) {
      const mutated = t.map((q, i) => (i === 0 ? { ...q, answer: bad as number } : q));
      const res = validateQuestions(mutated);
      assert.equal(res.ok, false, `answer ${String(bad)} should be rejected`);
    }
    const huge = t.map((q, i) => (i === 0 ? { ...q, answer: 1e30 } : q));
    assert.equal(validateQuestions(huge).ok, false);
  });
  it("rejects bad prompts, units, reasoning, difficulty, citations", () => {
    const t = trio();
    const cases: Array<[string, CandidateQuestion[]]> = [
      ["short prompt", t.map((q, i) => (i === 1 ? { ...q, prompt: "How many?" } : q))],
      ["no question mark", t.map((q, i) => (i === 1 ? { ...q, prompt: "How many bricks exist" } : q))],
      ["empty unit", t.map((q, i) => (i === 1 ? { ...q, unit: " " } : q))],
      ["one reasoning step", t.map((q, i) => (i === 1 ? { ...q, reasoning: ["only one"] } : q))],
      ["bad difficulty", t.map((q, i) => (i === 1 ? { ...q, difficulty: 5 } : q))],
      [
        "citation URL",
        t.map((q, i) =>
          i === 1 ? { ...q, reasoning: ["See https://example.com for proof.", "Round it."] } : q
        ),
      ],
      ["same category x3", t.map((q) => ({ ...q, category: "space" }))],
    ];
    for (const [name, qs] of cases) {
      assert.equal(validateQuestions(qs).ok, false, name);
    }
  });
});

describe("duplicate detection", () => {
  it("normalizes prompts", () => {
    assert.equal(normalizePrompt("  How MANY  trees?! "), "how many trees");
  });
  it("catches exact and paraphrased duplicates", () => {
    assert.equal(promptsDuplicate("How many trees are on Earth?", "how many trees are on earth"), true);
    assert.equal(
      promptsDuplicate("How many trees are on Earth?", "Approximately how many trees exist worldwide?"),
      true
    );
    assert.equal(findDuplicate("How many trees are on Earth?", ["How many ants exist?", "How many TREES are on earth??"]), "How many TREES are on earth??");
    assert.equal(findDuplicate("How many trees are on Earth?", ["How many ants exist?"]), null);
  });
  it("passes genuinely different questions", () => {
    assert.equal(promptsDuplicate("How many bricks are in the Empire State Building?", "How many cups of tea are drunk in Britain each day?"), false);
    assert.equal(similarity("How many stars are in the Milky Way?", "How many cups of tea are drunk daily?") < 0.6, true);
  });
  it("validation rejects batches duplicating recent prompts", () => {
    const t = trio();
    const res = validateQuestions(t, ["How many craters are on the Moon?"]);
    assert.equal(res.ok, false);
  });
});

describe("game file persistence", () => {
  it("does not overwrite an existing file without --force", () => {
    const dir = tmpDir();
    const game = gameFile("2026-09-17", numberForDate("2026-09-17"));
    assert.equal(saveGameFile(game, { baseDir: dir }), "written");
    assert.equal(saveGameFile(game, { baseDir: dir }), "exists");
    const other = { ...game, generationMode: "fallback" as const };
    assert.equal(saveGameFile(other, { baseDir: dir }), "exists");
    const kept = JSON.parse(fs.readFileSync(gameFilePath("2026-09-17", dir), "utf8"));
    assert.equal(kept.generationMode, "llm");
    assert.equal(saveGameFile(other, { baseDir: dir, force: true }), "written");
    const replaced = JSON.parse(fs.readFileSync(gameFilePath("2026-09-17", dir), "utf8"));
    assert.equal(replaced.generationMode, "fallback");
  });
});

describe("fallback", () => {
  it("produces exactly 3 valid questions in fallback mode", () => {
    const game = fallbackGameForDate("2026-09-17", "gemini-3.5-flash-lite");
    assert.equal(game.generationMode, "fallback");
    assert.equal(game.gameNumber, numberForDate("2026-09-17"));
    assert.equal(game.questions.length, 3);
    assert.deepEqual(
      game.questions.map((q) => q.id),
      ["2026-09-17-01", "2026-09-17-02", "2026-09-17-03"]
    );
    assert.equal(validateGameFileJSON(game).ok, true);
  });
  it("fallback is deterministic per date", () => {
    assert.deepEqual(fallbackGameForDate("2026-09-18", "m"), fallbackGameForDate("2026-09-18", "m"));
  });
});

describe("recent-question collection", () => {
  it("collects prompts from the window before the target date", () => {
    const dir = tmpDir();
    saveGameFile(gameFile("2026-09-10", numberForDate("2026-09-10")), { baseDir: dir });
    saveGameFile(gameFile("2026-09-15", numberForDate("2026-09-15")), { baseDir: dir });
    const recents = collectRecentPrompts("2026-09-17", 90, dir);
    assert.equal(recents.length, 6);
    // Newest first.
    assert.ok(recents[0].includes("craters"));
    // Out-of-window files are ignored.
    assert.equal(collectRecentPrompts("2026-09-17", 2, dir).length, 3);
    // Missing dates are skipped silently.
    assert.equal(collectRecentPrompts("2026-01-05", 3, dir).length, 0);
  });
});

describe("generated game loading + archive compatibility", () => {
  it("loads the generated file as the primary source", () => {
    const dir = tmpDir();
    const game = gameFile("2026-09-17", numberForDate("2026-09-17"));
    saveGameFile(game, { baseDir: dir });
    const loaded = getDailyGame("2026-09-17", dir);
    assert.equal(loaded.number, game.gameNumber);
    assert.equal(loaded.questions[0].prompt, game.questions[0].prompt);
    assert.equal(loaded.questions[0].explanation, game.questions[0].reasoning.join(" "));
    assert.equal(loadGameFile("2026-09-17", dir)?.generationMode, "llm");
    assert.equal(loadGameFile("2026-09-16", dir), null);
  });
  it("falls back to the pool game when no file exists", () => {
    const dir = tmpDir();
    const loaded = getDailyGame("2026-09-17", dir);
    assert.deepEqual(loaded, gameForNumber(numberForDate("2026-09-17")));
  });
  it("ignores corrupt files and falls back", () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, "data", "games"), { recursive: true });
    fs.writeFileSync(path.join(dir, "data", "games", "2026-09-17.json"), "{oops", "utf8");
    assert.equal(loadGameFile("2026-09-17", dir), null);
    assert.deepEqual(getDailyGame("2026-09-17", dir), gameForNumber(numberForDate("2026-09-17")));
  });
  it("resolves archive ids from files, pool games otherwise", () => {
    const dir = tmpDir();
    const n = numberForDate("2026-09-17");
    saveGameFile(gameFile("2026-09-17", n), { baseDir: dir });
    const fromFile = getGameById(padId(n), dir);
    assert.ok(fromFile);
    assert.equal(fromFile.questions[0].prompt, trio()[0].prompt);
    // Pre-generation date: same id scheme, pool questions.
    const old = getGameById("042", dir);
    assert.ok(old);
    assert.equal(old.number, 42);
    assert.deepEqual(old.questions, gameForNumber(42).questions);
    assert.equal(getGameById("nope", dir), null);
    assert.equal(getGameById("0", dir), null);
  });
  it("converts files to the DailyGame shape the UI expects", () => {
    const g = generatedFileToDailyGame(gameFile("2026-09-17", numberForDate("2026-09-17")));
    assert.equal(g.id, padId(g.number));
    assert.ok(g.dateLabel.length > 0);
    assert.equal(g.questions.length, 3);
  });
});

describe("two-pass orchestration (mocked network)", () => {
  const criticQs = [
    cand("How many impact craters mark the Moon's surface?", 9000, "craters", "space"),
    trio()[1],
    trio()[2],
  ];
  const freshTrio = [
    cand("How many grains of sand are on all beaches combined?", 7.5e18, "grains", "nature", 3),
    cand("How many text messages are sent worldwide each day?", 2.3e10, "messages", "technology"),
    cand("How many loaves of bread does France bake in a year?", 1e10, "loaves", "food"),
  ];

  it("runs generator then critic and returns final questions", async () => {
    const calls: string[] = [];
    const res = await generateDailyQuestions({
      dateISO: "2026-09-17",
      gameNumber: 79,
      recentPrompts: [],
      poolPrompts: [],
      requestText: async (kind, _prompt) => {
        calls.push(kind);
        return JSON.stringify({ questions: kind === "generate" ? trio() : criticQs });
      },
    });
    assert.deepEqual(calls, ["generate", "critic"]);
    assert.equal(res.questions.length, 3);
    assert.equal(res.generatorAttempts, 1);
    assert.equal(res.criticAttempts, 1);
  });
  it("retries the generator after a duplicate, then succeeds", async () => {
    const freshCritic = [
      cand("How many satellites orbit the Earth?", 11000, "satellites", "space"),
      cand("How many eggs do hens lay worldwide each day?", 200000000, "eggs", "food", 3),
      cand("How many kilometres of motorway are there in France?", 12000, "kilometres", "transport"),
    ];
    let n = 0;
    const res = await generateDailyQuestions({
      dateISO: "2026-09-17",
      gameNumber: 79,
      recentPrompts: ["How many craters are on the Moon?"],
      poolPrompts: [],
      requestText: async (kind) => {
        n++;
        if (kind === "critic") return JSON.stringify({ questions: freshCritic });
        if (n === 1) return JSON.stringify({ questions: trio() }); // duplicates recent
        return JSON.stringify({ questions: freshTrio });
      },
    });
    assert.equal(res.generatorAttempts, 2);
    assert.equal(res.questions.length, 3);
  });
  it("throws GenerationFailedError when the model keeps failing", async () => {
    await assert.rejects(
      generateDailyQuestions({
        dateISO: "2026-09-17",
        gameNumber: 79,
        recentPrompts: [],
        poolPrompts: [],
        requestText: async () => {
          throw new Error("boom");
        },
      }),
      (e: unknown) => e instanceof GenerationFailedError && e.attempts > 0
    );
  });
  it("throws when output is never valid JSON", async () => {
    await assert.rejects(
      generateDailyQuestions({
        dateISO: "2026-09-17",
        gameNumber: 79,
        recentPrompts: [],
        poolPrompts: [],
        requestText: async () => "definitely not json {{{",
      }),
      GenerationFailedError
    );
  });
});
