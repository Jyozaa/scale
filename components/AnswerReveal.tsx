"use client";

import { useEffect, useMemo, useRef } from "react";
import { formatFull } from "@/lib/formatting";
import { directionOf, formatFactor } from "@/lib/scoring";
import { emojiFor, phraseFor, tierForFactor, verdictFor } from "@/lib/feedback";
import { playBadResult, playGoodResult, playGreatResult } from "@/lib/sounds";
import { ScaleVisualization } from "./ScaleVisualization";

export function AnswerReveal({
  gameId,
  questionIndex,
  prompt,
  guess,
  answer,
  unit,
  factor,
  explanation,
  source,
  onNext,
  isLast,
}: {
  gameId: string;
  questionIndex: number;
  prompt: string;
  guess: number;
  answer: number;
  unit: string;
  factor: number;
  explanation: string;
  source?: string;
  onNext: () => void;
  isLast: boolean;
}) {
  const dir = directionOf(guess, answer);
  const tier = tierForFactor(factor);
  const phrase = useMemo(
    () => phraseFor(gameId, questionIndex, factor),
    [gameId, questionIndex, factor]
  );
  const emoji = useMemo(
    () => emojiFor(gameId, questionIndex, tier),
    [gameId, questionIndex, tier]
  );
  const verdict = verdictFor(tier, dir);

  const sounded = useRef("");
  useEffect(() => {
    const key = `${gameId}-${questionIndex}-${factor}`;
    if (sounded.current === key) return;
    sounded.current = key;
    if (tier === "perfect" || tier === "great") playGreatResult();
    else if (tier === "good" || tier === "okay") playGoodResult();
    else playBadResult();
  }, [gameId, questionIndex, factor, tier]);

  const badgeClass =
    tier === "perfect" || tier === "great" || tier === "good"
      ? "result-badge-good"
      : tier === "okay"
        ? "result-badge-mid"
        : "result-badge-bad";

  return (
    <div className="anim-rise">
      <p
        style={{
          fontSize: 13.5,
          color: "var(--muted)",
          margin: "0 0 20px",
          textAlign: "center",
          maxWidth: "46ch",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {prompt}
      </p>

      <div className="surface-card anim-pop" style={{ padding: "clamp(28px, 5vw, 44px) clamp(22px, 4vw, 40px)", textAlign: "center" }}>
        <p
          className="score-display numeral"
          style={{ margin: 0, fontSize: "clamp(64px, 13vw, 96px)", lineHeight: 1 }}
          aria-live="polite"
          aria-label={`${formatFactor(factor)}, ${verdict}. ${phrase}`}
        >
          {formatFactor(factor)}
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 15, fontWeight: 600, color: "var(--muted)" }}>
          {verdict}
        </p>
        <p
          className="display"
          style={{ margin: "16px auto 0", fontSize: "clamp(17px, 3vw, 21px)", maxWidth: "30ch", lineHeight: 1.4 }}
        >
          &ldquo;{phrase}&rdquo;{emoji && <span aria-hidden="true"> {emoji}</span>}
        </p>

        <div className="result-compare numeral">
          <div className="result-cell">
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--faint)" }}>
              Your guess
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 800, fontFamily: "var(--font-display)" }}>
              {formatFull(guess)}
            </p>
            {unit && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--muted)" }}>{unit}</p>}
          </div>
          <div className="result-cell">
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--faint)" }}>
              Actual
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 800, fontFamily: "var(--font-display)" }}>
              {formatFull(answer)}
            </p>
            {unit && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--muted)" }}>{unit}</p>}
          </div>
        </div>

        <p style={{ margin: "18px 0 0" }}>
          <span className={badgeClass}>
            {dir === "exact" ? "= Exact" : dir === "high" ? "↑ Too high" : "↓ Too low"}
          </span>
        </p>

        <ScaleVisualization guess={guess} answer={answer} />
      </div>

      <div className="tint-card" style={{ marginTop: 16, padding: "20px 22px" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
          How you could have estimated it
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.65, color: "var(--ink-soft)" }}>
          {explanation}
        </p>
        {source && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
            Source: {source}
          </p>
        )}
      </div>

      <button type="button" className="btn-primary" onClick={onNext} style={{ marginTop: 20, width: "100%" }}>
        {isLast ? "See your score" : "Next question"}
      </button>
    </div>
  );
}
