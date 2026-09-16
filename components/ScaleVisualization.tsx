"use client";

import { useMemo, type CSSProperties } from "react";
import { formatCompact } from "@/lib/formatting";

/**
 * Scale's signature visual: two soft dots on a rounded track.
 * Your estimate vs the answer on a quiet log scale.
 */
export function ScaleVisualization({ guess, answer }: { guess: number; answer: number }) {
  const model = useMemo(() => {
    const logG = Math.log10(Math.max(guess, 1e-12));
    const logA = Math.log10(Math.max(answer, 1e-12));
    let lo = Math.min(logG, logA) - 0.55;
    let hi = Math.max(logG, logA) + 0.55;
    if (hi - lo < 2) {
      const mid = (hi + lo) / 2;
      lo = mid - 1;
      hi = mid + 1;
    }
    const span = hi - lo;
    const pos = (log: number) => Math.min(94, Math.max(6, ((log - lo) / span) * 100));
    return { posG: pos(logG), posA: pos(logA) };
  }, [guess, answer]);

  const { posG, posA } = model;
  const overlap = Math.abs(posG - posA) < 7;
  const mid = (posG + posA) / 2;
  // Keep edge labels inside the card.
  const shift = (x: number) =>
    x > 85 ? "translateX(-75%)" : x < 15 ? "translateX(-25%)" : "translateX(-50%)";

  const dotStyle = (bg: string): CSSProperties => ({
    display: "block",
    width: 20,
    height: 20,
    borderRadius: 999,
    background: bg,
    border: "4px solid var(--surface)",
    boxShadow: "0 2px 10px rgba(32,32,34,0.12)",
  });

  const labelStyle = (color: string): CSSProperties => ({
    position: "absolute",
    top: 26,
    left: "50%",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    color,
    whiteSpace: "nowrap",
  });

  return (
    <figure style={{ margin: "26px 0 0" }} aria-hidden="false">
      <div
        style={{ position: "relative", height: 72 }}
        role="img"
        aria-label={`You estimated ${formatCompact(guess)}. The answer was ${formatCompact(answer)}.`}
      >
        {/* soft track */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            top: 20,
            height: 10,
            borderRadius: 999,
            background: "var(--surface-secondary)",
          }}
        />
        {overlap ? (
          <span
            aria-hidden="true"
            style={{ position: "absolute", left: `${mid}%`, top: 20, transform: "translate(-50%, -50%)" }}
          >
            <span style={{ ...dotStyle("var(--sage)"), outline: "2px solid var(--text)", outlineOffset: -1 }} />
            <span style={{ ...labelStyle("var(--sage-deep)"), transform: shift(mid) }}>
              You · Actual
            </span>
          </span>
        ) : (
          <>
            <span aria-hidden="true" style={{ position: "absolute", left: `${posA}%`, top: 20, transform: "translate(-50%, -50%)" }}>
              <span style={dotStyle("var(--text)")} />
              <span style={{ ...labelStyle("var(--muted)"), transform: shift(posA) }}>
                Actual
              </span>
            </span>
            <span aria-hidden="true" style={{ position: "absolute", left: `${posG}%`, top: 20, transform: "translate(-50%, -50%)" }}>
              <span style={dotStyle("var(--coral)")} />
              <span style={{ ...labelStyle("var(--coral-deep)"), transform: shift(posG) }}>
                You
              </span>
            </span>
          </>
        )}
      </div>
    </figure>
  );
}
