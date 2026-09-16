/**
 * Prompts + strict JSON schema for Scale's two-pass daily generation.
 *
 * Kept in a dedicated module (not buried in workflow YAML) so the script,
 * tests, and future editors all share one source of truth.
 *
 * Deliberately: no sarcastic result phrases here (those live in
 * lib/feedback.ts), no citations/URLs, stable Fermi-style quantities only.
 */

import type { JsonSchemaSpec } from "./zen";

/** Strict-mode JSON schema: every property required, no extras. */
export const QUESTIONS_JSON_SCHEMA: JsonSchemaSpec = {
  name: "scale_daily_questions",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["prompt", "answer", "unit", "category", "reasoning", "difficulty"],
          properties: {
            prompt: { type: "string" },
            answer: { type: "number" },
            unit: { type: "string" },
            category: { type: "string" },
            reasoning: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: { type: "string" },
            },
            difficulty: { type: "integer", minimum: 1, maximum: 3 },
          },
        },
      },
    },
  },
};

export interface GeneratorPromptOpts {
  dateISO: string;
  gameNumber: number;
  /** Prompts from recent generated games (newest first). */
  recentPrompts: string[];
  /** Prompts from the bundled fallback pool. */
  poolPrompts: string[];
  /** Added on retries: what went wrong last time. */
  retryNote?: string;
}

const SHARED_RULES = `Each question MUST:
- have one primary numerical answer with an unambiguous unit (e.g. "litres", "kilometres", "people")
- reward estimation (decomposition, approximate quantities, orders of magnitude, everyday intuition) rather than memorisation
- permit a useful rough reasoning path of 2-4 short steps whose arithmetic approximately leads to the stated answer
- have a reasonably stable factual answer that will still be correct in a year
- be worded unambiguously, with no trick interpretations
- carry a sensible difficulty: 1 = most adults land within 3x, 2 = needs real decomposition, 3 = genuinely hard

Each question MUST NOT:
- depend on rapidly changing quantities (social-media counts, current prices, sales, traffic, elections, sports results)
- be obscure trivia, require specialist knowledge, or hinge on a single memorised fact
- touch politics, elections, current affairs, or sensitive personal topics
- include citations, source names, or URLs anywhere in the output
- be a trick question or have a subjective/debatable answer`;

export function buildGeneratorPrompt(opts: GeneratorPromptOpts): string {
  const recent =
    opts.recentPrompts.length > 0
      ? opts.recentPrompts.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "(none yet)";
  const pool =
    opts.poolPrompts.length > 0 ? opts.poolPrompts.map((p) => `- ${p}`).join("\n") : "(none)";
  const retry = opts.retryNote ? `\nIMPORTANT CORRECTION FOR THIS RETRY: ${opts.retryNote}\n` : "";
  return `You write questions for Scale, a daily numerical estimation game, for the game dated ${opts.dateISO} (Scale game #${opts.gameNumber}).
${retry}
Generate EXACTLY 3 questions.

${SHARED_RULES}

DIVERSITY (required):
- The three questions must come from three DIFFERENT categories (e.g. space, food, transport, nature, science, geography, infrastructure, technology, people, sport, everyday life — these are suggestions, not a fixed list).
- Prefer answers at different orders of magnitude (e.g. one near 10^3, one near 10^7, one near 10^12) rather than three similar-sized answers. Treat this as a preference, never invent an unnatural question to force it.

AVOID REPETITION:
Do NOT generate the same question or a substantially similar question as any of these recent or existing questions. Rephrasings count as duplicates — e.g. "How many trees are on Earth?" and "Approximately how many trees exist worldwide?" are the SAME question:
--- recent games ---
${recent}
--- existing question bank ---
${pool}

OUTPUT: JSON only, no markdown fences, no commentary. Exactly this shape:
{"questions": [{"prompt": "How many ...?", "answer": 12345, "unit": "widgets", "category": "everyday life", "reasoning": ["step one with a number", "step two with a number", "combine them"], "difficulty": 2}, ...]}
The answer must be a plain JSON number (no commas, no ranges, no units inside the number). The prompt must end with "?".`;
}

export interface CriticPromptOpts {
  dateISO: string;
  /** The generator's candidate questions, as JSON. */
  candidatesJson: string;
}

export function buildCriticPrompt(opts: CriticPromptOpts): string {
  return `You are the quality-control editor for Scale, a daily numerical estimation game, for the game dated ${opts.dateISO}.

Audit these 3 candidate questions and return EXACTLY 3 corrected final questions:
${opts.candidatesJson}

${SHARED_RULES}

Check and fix:
1. Numerical plausibility — is the answer in the right ballpark? Correct it if it is clearly off.
2. Reasoning consistency — does the reasoning's arithmetic approximately lead to the answer? Fix whichever side is wrong (or both).
3. Ambiguous wording or units — rephrase so there is exactly one reasonable interpretation.
4. Estimatability — could a smart non-expert make progress by rough reasoning? Replace the question if not.
5. Stability — will the answer hold for at least a year? Replace it if not.
6. Duplicates — are any two candidates the same concept, or the same concept as each other? Replace as needed.
7. Category diversity — all three must be from different categories.
8. Anything fabricated, nonsensical, or containing citations/URLs — remove or fix.

OUTPUT: JSON only, no markdown fences, no commentary. Exactly this shape:
{"questions": [{"prompt": "How many ...?", "answer": 12345, "unit": "widgets", "category": "everyday life", "reasoning": ["step one", "step two"], "difficulty": 2}, ...]}
Keep good questions unchanged; only edit what needs editing. Exactly 3 questions. The prompt must end with "?".`;
}
