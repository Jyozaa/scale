"use client";

import { useCallback, useEffect, useState } from "react";
import type { DailyGame } from "@/lib/puzzles";
import { parseEstimate } from "@/lib/formatting";
import { overallScore, scoreFactor } from "@/lib/scoring";
import { categoryFor } from "@/lib/feedback";
import { playNext, playSubmit } from "@/lib/sounds";
import {
  completeGame,
  getGameRecord,
  saveAttempt,
  saveStage,
  type QuestionAttempt,
} from "@/lib/persistence";
import { EstimateInput } from "./EstimateInput";
import { AnswerReveal } from "./AnswerReveal";
import { DailyResults } from "./DailyResults";

function Progress({ index }: { index: number }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p
        className="numeral"
        style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "var(--muted)", textAlign: "center" }}
        aria-label={`Question ${index + 1} of 3`}
      >
        Question {index + 1} of 3
      </p>
      <div className="progress-segs" role="img" aria-label={`${index + 1} of 3 answered`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`progress-seg${i < index ? " done" : i === index ? " now" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Owns per-game flow: which screen is showing (stage 0–2 = question,
 * 3 = results), guesses, reveals, and completion. Refresh-safe.
 */
export function GameClient({ game }: { game: DailyGame }) {
  const [attempts, setAttempts] = useState<Record<number, QuestionAttempt>>({});
  const [stage, setStage] = useState(0);
  const [raw, setRaw] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const rec = getGameRecord(game.id);
    if (rec) {
      const at = rec.attempts ?? {};
      setAttempts(at);
      const revealed = [0, 1, 2].filter((i) => at[i]?.revealed).length;
      // Never show a screen the player hasn't unlocked.
      const maxStage = revealed >= 3 ? 3 : Math.min(revealed, 2);
      const s = rec.stage ?? Math.min(revealed, 2);
      setStage(Math.max(0, Math.min(s, maxStage)));
    }
    setHydrated(true);
  }, [game.id]);

  useEffect(() => {
    setRaw("");
    setSubmitError(null);
  }, [stage, game.id]);

  const allRevealed =
    !!attempts[0]?.revealed && !!attempts[1]?.revealed && !!attempts[2]?.revealed;
  // Results appear only after the player advances past the Q3 reveal.
  const done = hydrated && allRevealed && stage === 3;

  useEffect(() => {
    if (!done) return;
    const overall = overallScore([
      attempts[0].factor,
      attempts[1].factor,
      attempts[2].factor,
    ]);
    if (Number.isFinite(overall)) completeGame(game.id, overall);
  }, [done, attempts, game.id]);

  const submit = useCallback(() => {
    const parsed = parseEstimate(raw);
    if (!parsed.ok) {
      setSubmitError(parsed.error ?? "Enter a number first.");
      return;
    }
    const answer = game.questions[Math.min(stage, 2)].answer;
    const factor = scoreFactor(parsed.value, answer);
    if (!Number.isFinite(factor)) {
      setSubmitError("Something went wrong with that number — try again.");
      return;
    }
    playSubmit();
    const attempt: QuestionAttempt = {
      guess: parsed.value,
      raw: raw.trim(),
      revealed: true,
      factor,
    };
    saveAttempt(game.id, Math.min(stage, 2), attempt);
    setAttempts((prev) => ({ ...prev, [Math.min(stage, 2)]: attempt }));
    setSubmitError(null);
  }, [raw, game, stage]);

  const next = useCallback(() => {
    playNext();
    const n = Math.min(stage + 1, 3);
    saveStage(game.id, n);
    setStage(n);
    document.getElementById("question-top")?.scrollIntoView({ block: "start" });
  }, [stage, game.id]);

  if (!hydrated) {
    return (
      <div className="game-shell" style={{ paddingTop: 64, paddingBottom: 80 }}>
        <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center" }}>Loading…</p>
      </div>
    );
  }

  if (done) {
    const guesses = [attempts[0].guess, attempts[1].guess, attempts[2].guess];
    const factors = [attempts[0].factor, attempts[1].factor, attempts[2].factor];
    return (
      <div className="game-shell" style={{ paddingTop: 48, paddingBottom: 64 }}>
        <DailyResults
          game={game}
          guesses={guesses}
          factors={factors}
          overall={overallScore(factors)}
        />
      </div>
    );
  }

  const qi = Math.min(stage, 2);
  const question = game.questions[qi];
  const currentAttempt = attempts[qi];
  const revealed = !!currentAttempt?.revealed;
  const category = categoryFor(question.prompt);

  return (
    <div
      className="game-shell"
      id="question-top"
      style={{ paddingTop: 40, paddingBottom: 72, scrollMarginTop: 24 }}
    >
      <Progress index={qi} />

      {!revealed ? (
        <div className="anim-rise">
          <div className="question-card">
            {category && (
              <p style={{ margin: "0 0 16px", fontSize: 22 }} aria-hidden="true">
                {category}
              </p>
            )}
            <h1
              className="display"
              style={{
                fontSize: "clamp(26px, 4.6vw, 36px)",
                margin: 0,
                maxWidth: "24ch",
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.25,
              }}
            >
              {question.prompt}
            </h1>
            <div style={{ marginTop: 32 }}>
              <EstimateInput
                key={`${game.id}-${qi}`}
                unit={question.unit}
                value={raw}
                onChange={(v) => {
                  setRaw(v);
                  if (submitError) setSubmitError(null);
                }}
                onSubmit={submit}
                autoFocus
              />
            </div>
            {submitError && (
              <p
                role="alert"
                style={{ fontSize: 13.5, color: "var(--error)", margin: "12px 0 0" }}
              >
                {submitError}
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            style={{ marginTop: 20 }}
          >
            <button type="submit" className="btn-primary" style={{ width: "100%" }}>
              Submit guess
            </button>
          </form>
        </div>
      ) : (
        currentAttempt && (
          <AnswerReveal
            gameId={game.id}
            questionIndex={qi}
            prompt={question.prompt}
            guess={currentAttempt.guess}
            answer={question.answer}
            unit={question.unit}
            factor={currentAttempt.factor}
            explanation={question.explanation}
            source={question.source}
            onNext={next}
            isLast={qi === 2}
          />
        )
      )}
    </div>
  );
}
