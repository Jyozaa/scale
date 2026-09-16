/**
 * Runtime validation + duplicate detection for generated questions.
 *
 * Hand-rolled on purpose: no new dependencies, and the same module is used
 * by the generation script, the test suite, and (for file loading) the app.
 * Never trust TypeScript types alone for LLM output — everything from the
 * model passes through here first.
 */

export interface CandidateQuestion {
  prompt: string;
  answer: number;
  unit: string;
  category: string;
  reasoning: string[];
  difficulty: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  questions?: CandidateQuestion[];
}

export const MAX_PROMPT_LENGTH = 220;
export const MIN_PROMPT_LENGTH = 12;
export const MAX_ANSWER = 1e21;
/** Jaccard token-overlap at or above this counts as "substantially similar". */
export const SIMILARITY_THRESHOLD = 0.6;

const STOPWORDS = new Set(
  "a,an,the,of,in,on,at,to,for,by,with,from,as,is,are,was,were,be,been,how,many,much,does,do,there,their,its,it,this,that,these,those,what,when,where,which,who,average,per,each,total,approximately,about,around,roughly,current,currently,today,every,all,into,over,under,than,then,or,and,number".split(
    ","
  )
);

/** Tiny synonym map so rephrasings ("Earth" vs "worldwide") still match. */
const SYNONYMS: Record<string, string> = {
  worldwide: "world",
  global: "world",
  globe: "world",
  earth: "world",
};

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizePrompt(s: string): string {
  const words = s
    .toLowerCase()
    .replace(/[''’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  const mapped: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    mapped.push(SYNONYMS[w] !== undefined ? SYNONYMS[w] : w);
  }
  return mapped.join(" ");
}

export function promptTokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Token-overlap similarity in [0, 1]. */
export function similarity(a: string, b: string): number {
  const ta = new Set(promptTokens(normalizePrompt(a)));
  const tb = new Set(promptTokens(normalizePrompt(b)));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  return inter / (ta.size + tb.size - inter);
}

/**
 * True when two prompts are the same question or substantially similar.
 * Exact normalized match, or high token overlap.
 */
export function promptsDuplicate(a: string, b: string): boolean {
  if (normalizePrompt(a) === normalizePrompt(b)) return true;
  return similarity(a, b) >= SIMILARITY_THRESHOLD;
}

/** First recent prompt that duplicates `prompt`, or null. */
export function findDuplicate(prompt: string, recents: string[]): string | null {
  for (const r of recents) {
    if (promptsDuplicate(prompt, r)) return r;
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function checkQuestion(
  q: unknown,
  index: number,
  errors: string[]
): CandidateQuestion | null {
  const label = `questions[${index}]`;
  if (!isRecord(q)) {
    errors.push(`${label} must be an object.`);
    return null;
  }
  let valid = true;
  const need = (cond: boolean, msg: string) => {
    if (!cond) {
      errors.push(`${label} ${msg}`);
      valid = false;
    }
  };

  const prompt = q.prompt;
  need(typeof prompt === "string" && prompt.trim().length >= MIN_PROMPT_LENGTH, "needs a prompt.");
  if (typeof prompt === "string") {
    if (prompt.trim().length > MAX_PROMPT_LENGTH) {
      errors.push(`${label} prompt is too long (max ${MAX_PROMPT_LENGTH} chars).`);
      valid = false;
    }
    if (!prompt.trim().endsWith("?")) {
      errors.push(`${label} prompt must end with a question mark.`);
      valid = false;
    }
  }

  const answer = q.answer;
  need(
    typeof answer === "number" &&
      Number.isFinite(answer) &&
      answer > 0 &&
      answer <= MAX_ANSWER,
    "needs a finite numeric answer above zero."
  );

  const unit = q.unit;
  need(
    typeof unit === "string" && unit.trim().length >= 1 && unit.trim().length <= 40,
    "needs a short non-empty unit."
  );

  const category = q.category;
  need(
    typeof category === "string" &&
      category.trim().length >= 1 &&
      category.trim().length <= 30,
    "needs a non-empty category."
  );

  const reasoning = q.reasoning;
  need(
    Array.isArray(reasoning) &&
      reasoning.length >= 2 &&
      reasoning.length <= 4 &&
      reasoning.every(
        (s) => typeof s === "string" && s.trim().length > 0 && s.trim().length <= 400
      ),
    "needs 2–4 non-empty reasoning steps."
  );

  const difficulty = q.difficulty;
  need(
    typeof difficulty === "number" &&
      Number.isInteger(difficulty) &&
      difficulty >= 1 &&
      difficulty <= 3,
    "needs an integer difficulty of 1, 2 or 3."
  );

  // The model must not invent citations — URLs have no place in output.
  const text = `${typeof prompt === "string" ? prompt : ""} ${
    Array.isArray(reasoning) ? reasoning.filter((s) => typeof s === "string").join(" ") : ""
  }`;
  if (/https?:\/\//i.test(text) || /\bdoi\s*:/i.test(text)) {
    errors.push(`${label} must not contain URLs or citations.`);
    valid = false;
  }

  if (!valid) return null;
  return {
    prompt: (prompt as string).trim(),
    answer: answer as number,
    unit: (unit as string).trim(),
    category: (category as string).trim().toLowerCase(),
    reasoning: (reasoning as string[]).map((s) => s.trim()),
    difficulty: difficulty as number,
  };
}

/**
 * Validate one batch of exactly 3 candidate questions (generator or critic
 * output). `recents` are prompts to treat as duplicates.
 */
export function validateQuestions(
  value: unknown,
  recents: string[] = []
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(value) || value.length !== 3) {
    return {
      ok: false,
      errors: [
        `Expected exactly 3 questions, got ${
          Array.isArray(value) ? value.length : typeof value
        }.`,
      ],
      warnings,
    };
  }
  const questions: CandidateQuestion[] = [];
  value.forEach((q, i) => {
    const checked = checkQuestion(q, i, errors);
    if (checked) questions.push(checked);
  });
  if (errors.length > 0) return { ok: false, errors, warnings };

  // Prompts must be pairwise distinct within the batch.
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      if (promptsDuplicate(questions[i].prompt, questions[j].prompt)) {
        errors.push(
          `questions[${i}] and questions[${j}] are substantially similar — pick different topics.`
        );
      }
    }
  }
  // Category diversity: not all three from the same category.
  if (new Set(questions.map((q) => q.category)).size === 1) {
    errors.push(
      `All three questions share category "${questions[0].category}" — diversify topics.`
    );
  }
  // Duplicate check against recent games.
  for (let i = 0; i < questions.length; i++) {
    const dup = findDuplicate(questions[i].prompt, recents);
    if (dup) {
      errors.push(
        `questions[${i}] duplicates a recent question ("${dup.slice(0, 80)}…") — generate a different one.`
      );
    }
  }
  if (errors.length > 0) return { ok: false, errors, warnings };

  // Magnitude diversity is a soft preference, never a rejection.
  const orders = questions.map((q) => Math.floor(Math.log10(q.answer)));
  if (new Set(orders).size === 1) {
    warnings.push(
      `All three answers sit near 10^${orders[0]} — prefer a wider spread of magnitudes next time.`
    );
  }
  return { ok: true, errors, warnings, questions };
}
