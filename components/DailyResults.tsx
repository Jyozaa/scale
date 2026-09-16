"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DailyGame } from "@/lib/puzzles";
import { directionOf, formatFactor } from "@/lib/scoring";
import { formatCompact } from "@/lib/formatting";
import { phraseFor } from "@/lib/feedback";
import { playComplete, playTap } from "@/lib/sounds";
import { playerComparison } from "@/lib/players";
import { buildShareText, shareResult } from "@/lib/share";

export function DailyResults({
  game,
  guesses,
  factors,
  overall,
}: {
  game: DailyGame;
  guesses: number[];
  factors: number[];
  overall: number;
}) {
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared" | "failed">("idle");
  const [timer, setTimer] = useState<number | null>(null);

  const comp = useMemo(
    () => playerComparison(game.id, game.questions.map((q) => q.answer), overall),
    [game, overall]
  );

  const overallPhrase = useMemo(
    () => phraseFor(game.id, 99, overall),
    [game.id, overall]
  );

  const sounded = useRef("");
  useEffect(() => {
    if (sounded.current === game.id) return;
    sounded.current = game.id;
    playComplete();
  }, [game.id]);

  const shareText = useMemo(
    () =>
      buildShareText(
        game.number,
        overall,
        factors.map((factor, i) => {
          const d = directionOf(guesses[i], game.questions[i].answer);
          return { factor, high: d === "high", exact: d === "exact" };
        })
      ),
    [game, factors, guesses, overall]
  );

  async function onShare() {
    playTap();
    if (timer !== null) window.clearTimeout(timer);
    const r = await shareResult(shareText);
    if (r === "cancelled") {
      setShareState("idle");
      setTimer(null);
      return;
    }
    setShareState(r === "copied" ? "copied" : r === "shared" ? "shared" : "failed");
    setTimer(window.setTimeout(() => setShareState("idle"), 2400));
  }

  return (
    <div className="anim-rise" style={{ paddingBottom: 8, textAlign: "center" }}>
      <p className="numeral" style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--faint)" }}>
        Scale #{game.id} · {game.dateLabel}
      </p>
      <h2
        className="score-display numeral"
        style={{ margin: 0, fontSize: "clamp(72px, 15vw, 104px)", lineHeight: 1 }}
        aria-live="polite"
      >
        {formatFactor(overall)}
      </h2>
      <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>
        average error
      </p>
      <p
        className="display"
        style={{ margin: "14px auto 0", fontSize: "clamp(17px, 3vw, 20px)", maxWidth: "30ch", lineHeight: 1.4 }}
      >
        &ldquo;{overallPhrase}&rdquo;
      </p>

      <div className="surface-card" style={{ padding: "10px 22px", textAlign: "left", marginTop: 28 }}>
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {game.questions.map((q, i) => {
            const d = directionOf(guesses[i], q.answer);
            const arrow = d === "exact" ? "=" : d === "high" ? "↑" : "↓";
            const last = i === game.questions.length - 1;
            return (
              <li
                key={i}
                className="numeral"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 0",
                  fontSize: 15,
                  borderBottom: last ? "0" : "1px solid var(--line)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--faint)", minWidth: 22 }}>
                  0{i + 1}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: "var(--muted)" }}>
                  {formatCompact(guesses[i])} → {formatCompact(q.answer)} {q.unit}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19 }}>
                  {formatFactor(factors[i])}
                </span>
                <span aria-hidden="true" style={{ fontSize: 14, color: "var(--coral-deep)", width: 16, textAlign: "center" }}>
                  {arrow}
                </span>
                <span className="sr-only">{d === "exact" ? "exact" : d === "high" ? "high" : "low"}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <button type="button" className="btn-primary" onClick={onShare} style={{ marginTop: 24, width: "100%" }}>
        {shareState === "copied"
          ? "Copied"
          : shareState === "shared"
            ? "Shared"
            : shareState === "failed"
              ? "Copy failed — select the text below"
              : "Share result"}
      </button>

      <div style={{ marginTop: 12 }}>
        <Link href="/archive" className="btn-soft" style={{ width: "100%" }} onClick={() => playTap()}>
          Play another
        </Link>
      </div>

      <details className="others" style={{ marginTop: 24 }}>
        <summary className="btn-pill" style={{ listStyle: "none" }}>
          See how others guessed
        </summary>
        <div className="tint-card numeral" style={{ marginTop: 12, padding: "16px 20px", fontSize: 13.5, color: "var(--ink-soft)" }}>
          Better than {comp.percentile}% of estimators · median {formatFactor(comp.medianFactor)}
        </div>
      </details>

      {(shareState === "failed") && (
        <pre
          className="numeral"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            background: "var(--surface-secondary)",
            borderRadius: 16,
            padding: 16,
            whiteSpace: "pre-wrap",
            marginTop: 16,
            color: "var(--ink-soft)",
            textAlign: "left",
          }}
        >
          {shareText}
        </pre>
      )}
    </div>
  );
}
