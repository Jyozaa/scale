# Scale

**Scale is a beautifully minimal game about how well you understand the scale of the world.**

Three estimates a day. How close can you get? Each daily game asks three
numerical questions about quantities in the world — how many, how much, how far.
You estimate, the answer is revealed, and you see how many times too high or too
low you were. Your daily score is the geometric mean of the three factors.

This is an original game. Its genre (daily estimation) is shared with games like
Fermi, but Scale's branding, visual identity, copy, question set, visualisation,
and code are all its own.

## Setup

Requires Node.js ≥ 18.17.

```bash
npm install
npm run dev     # http://localhost:3000
```

Other commands:

```bash
npm test        # compile lib + tests, run node:test suites
npm run typecheck
npm run lint
npm run build
npm run generate:daily       # generate today's game (needs OPENCODE_API_KEY)
```

A fresh `npm install && npm run dev` is all you need — no env vars, no backend.

## Architecture

```
app/
  page.tsx          # homepage: today's number, one line, Play
  play/page.tsx     # today's game
  game/[id]/page.tsx# archived game (past games only; future ids 404 politely)
  archive/page.tsx  # 30-day replay list with played status + scores
  about/page.tsx    # estimation, Fermi problems, scoring maths
  submit/page.tsx   # question submissions (validated, stored locally)
  layout.tsx        # header, footer, metadata, skip link
  icon.svg          # the balance-scale mark as app icon
components/
  BrandMark.tsx         # original balance-scale SVG logo
  Header.tsx / Footer.tsx
  GameClient.tsx        # per-game flow: stage, guesses, reveals, completion
  EstimateInput.tsx     # large numeric field, k/m/b parsing, calculator toggle
  Calculator.tsx        # safe arithmetic (tokenize + shunting-yard, no eval)
  ScaleVisualization.tsx# quiet log rail: your dot vs the answer tick
  AnswerReveal.tsx      # estimate vs actual, factor, reasoning
  DailyResults.tsx      # overall score, per-question rows, share
lib/
  puzzles.ts        # 30-question pool (now: emergency fallback) + date/number math
  dailyGames.ts     # generated-game schema, data/games loading, fallback builder
  genPrompts.ts     # generator + critic prompts, strict JSON schema
  genValidate.ts    # runtime validation + duplicate detection (no new deps)
  generateGame.ts   # two-pass orchestration (network injectable for tests)
  zen.ts            # OpenCode Zen Responses client (server/script only)
  scoring.ts        # factor, geometric mean, direction, factor formatting
  formatting.ts     # estimate parsing (1,200 / 1.2k / 2.4m / 3b) + display
  persistence.ts    # localStorage store, isolated from UI
  seededRandom.ts   # hash + mulberry32 + Box–Muller normal
  players.ts        # deterministic synthetic estimator field
  share.ts          # share-text builder + native share / clipboard
scripts/
  generate-daily-game.ts  # CLI used locally AND by GitHub Actions
data/games/
  YYYY-MM-DD.json   # one committed game file per day (the archive)
test/
  scoring, formatting, puzzles, seededRandom, players, share suites
  dailyGames, zen suites (schema, duplicates, fallback, loading, mocked LLM)
```

No UI framework beyond React + Tailwind; no animation, icon, or chart libraries.
Numbers are set in Nunito/Inter with tabular figures.

## Puzzle format

Each daily game is dealt deterministically from a 30-question pool:

```ts
{
  id: "042",            // zero-padded game number
  number: 42,
  date: "2026-08-11",  // ISO, derived from game number
  questions: [
    {
      prompt: "How many … ?",
      answer: 6000000,  // positive finite number
      unit: "visitors",
      explanation: "Two or three multiplications a player could do.",
      source: "optional"
    }
    // …exactly 3
  ]
}
```

Game `n` shuffles the pool with `mulberry32(hashSeed("scale-game-n"))` and takes
the first three — so every visitor, on every device, gets the same three
questions for a given day, with no server. Launch day is 2026-07-01 (game #001).

Questions are original to Scale and chosen to reward decomposition over recall:
anchor on something known, multiply outward, sanity-check by a second route.

## Daily question generation

Scale generates exactly 3 fresh Fermi-style questions per day with an LLM.
The model is never called from a browser — generation happens once per day
in GitHub Actions (or manually via CLI), and the result is committed as JSON.
The app simply loads today's saved file.

Flow: Actions (00:05 UTC) → OpenCode Zen API (`muse-spark-1.3-contributor-free`)
→ generator pass → runtime validation → critic pass → validation again
→ write `data/games/YYYY-MM-DD.json` → commit + push → deploy serves it.

- **Endpoint/model:** `https://opencode.ai/zen/v1/responses`, model from
  `OPENCODE_MODEL` (default `muse-spark-1.3-contributor-free`). To change the
  model later, set the `OPENCODE_MODEL` variable (Actions) or env var (local).
- **File location:** `data/games/YYYY-MM-DD.json` — these files ARE the
  archive. Each carries `date`, `gameNumber` (from the launch-date math in
  `lib/puzzles.ts`, the single central helper), `generatedAt`, `model`,
  `generationMode` (`llm` | `fallback`), and exactly 3 questions with stable
  `YYYY-MM-DD-0i` ids.
- **App loading:** `getDailyGame(date)` / `getGameById(id)` in
  `lib/dailyGames.ts` read the file first and fall back to the bundled pool
  game for dates with no file (e.g. pre-generation archive dates). The UI
  only ever sees the existing `DailyGame` shape. Open tabs refresh past the
  daily rollover via `RolloverRefresh` (focus/visibility, no polling).
- **Duplication:** the generator receives recent prompts (90-day window from
  `data/games` plus the pool) with an explicit do-not-repeat instruction;
  `lib/genValidate.ts` additionally rejects exact normalized duplicates and
  high token-overlap paraphrases (tiny synonym map, no dependencies), and the
  generator retries with the failure reason as correction context.
- **Validation:** exactly 3 questions; finite positive answers; short units;
  2–4 reasoning steps that must approximately lead to the answer (checked by
  the critic); difficulty 1–3; three different categories; magnitude spread is
  a soft preference (warning, not rejection). No URLs/citations allowed —
  unverifiable sources are omitted, not fabricated.
- **Retries:** bounded (3 generator + 2 critic attempts; exponential backoff
  on network/5xx). Persistent failure → deterministic pool fallback is still
  written with `"generationMode": "fallback"`, so a day never has no game.
- **Idempotency:** existing files are never overwritten (scheduler-safe);
  `--force` is dev-only. Concurrency group `scale-daily-game` serializes runs.
- **Manual commands:**
  `npm run generate:daily` (today, UTC) ·
  `npm run generate:daily -- --date 2026-09-18` ·
  `npm run generate:daily -- --dry-run` (validate + print, write nothing).
  Local runs read `OPENCODE_API_KEY` from the environment (see `.env.example`).
- **Key safety:** the key lives only in the `OPENCODE_API_KEY` GitHub secret
  and local env — never in code, JSON, logs, or `NEXT_PUBLIC_*` variables.

## Scoring

Per question, the **factor** is the multiplicative error:

```
factor = max(guess / answer, answer / guess)
```

A perfect estimate scores 1×; guessing double or half scores 2×; an order of
magnitude off scores 10×. High and low are symmetric — direction is shown with
arrows and words (↑ High / ↓ Low), never colour alone.

The **daily score** is the geometric mean of the three factors:

```
overall = (f1 × f2 × f3) ^ (1/3)
```

Multiplicative errors need a multiplicative average: one wild guess can't hide
behind two good ones the way it could under an arithmetic mean. Rough guide:
under 1.5× is superb, under 3× is strong, under 5× is roughly calibrated,
above 10× the world just surprised you.

## Persistence

All state lives in `localStorage` under `scale:v1`, behind the small API in
`lib/persistence.ts` (UI never touches storage directly):

- `attempts` — per-question `{ guess, raw, revealed, factor }`
- `stage` — which screen is showing (0–2 question, 3 results); advances only
  on Continue, never on submit, so refresh restores the exact screen
- `completed` / `overall` / `completedAt` — set once when results are reached
- `submissions` — locally stored question suggestions

A refresh mid-game, mid-reveal, or on results restores exactly where you were.
Archive rows read the same store to show played status and scores per game.

## Seeded player distributions

"Other estimators" are synthetic and fully deterministic — pure functions of
game and question ids, never re-rolled per render:

- Daily comparison: 600 synthetic players, each guessing every question
  log-normally (σ ≈ 0.7 orders), scored with the same factor + geometric mean.
  Your percentile is the share of synthetic players you beat; the median
  synthetic score is shown alongside. The reveal rail itself shows only
  your dot vs the answer tick — no synthetic dots.

Seed scheme: `scale-<gameId>-q<qi>-p<p>` per guess.

## Share format

```
Scale #042
2.14×

01  ↑ 1.4×
02  ↓ 2.1×
03  ↑ 3.2×

https://scale.game
```

Arrows only, no emoji. Uses the native share sheet where available, clipboard
otherwise. The base URL is centralised as `SHARE_URL_BASE` in `lib/puzzles.ts`.

## Design philosophy

Scale feels soft, rounded, and quiet: a warm off-white ground (#F6F3ED),
near-black ink (#1D1D1A), soft beige surfaces (#ECE8E0), white elevated cards,
and one sparingly used green accent (#587266) for the single primary action
per screen. Roundness is intentional — pills for triggers, 12/16/24px radii
for surfaces, 20px for the estimate field, 28px for the calculator sheet —
with extremely soft shadows, generous whitespace, and friendly Nunito display
type. A separate rust tone is reserved for errors. Before adding a container,
ask whether it earns its place: most hierarchy comes from spacing, size,
and contrast, not cards.
