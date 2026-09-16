"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  dateForNumber,
  formatDateLabel,
  padId,
  todayNumber,
} from "@/lib/puzzles";
import { getCompletedMap, type GameRecord } from "@/lib/persistence";
import { formatFactor } from "@/lib/scoring";

const COUNT = 30;

export default function ArchivePage() {
  const [records, setRecords] = useState<Record<string, GameRecord>>({});
  const [rows, setRows] = useState<number[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Compute after mount so the server prerender can never disagree
    // with the client about what "today" is (avoids hydration mismatch).
    const today = todayNumber();
    setRows(
      Array.from({ length: COUNT }, (_, k) => today - k).filter((n) => n >= 1)
    );
    setRecords(getCompletedMap());
    setReady(true);
  }, []);

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 72, maxWidth: 680 }}>
      <h1 className="display" style={{ fontSize: "clamp(30px, 5vw, 40px)", margin: "0 0 8px", textAlign: "center" }}>
        Archive
      </h1>
      <p className="numeral" style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 32px", textAlign: "center" }}>
        {ready ? `${rows.length} games` : "Past games"}
      </p>
      {!ready ? (
        <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center" }}>Loading…</p>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2 }}>
          {rows.map((n, idx) => {
            const id = padId(n);
            const rec = records[id];
            const overall = rec?.overall ?? null;
            const played = overall !== null && Number.isFinite(overall);
            const date = formatDateLabel(dateForNumber(n));
            const isToday = idx === 0;
            return (
              <li key={id}>
                <Link
                  href={`/game/${id}`}
                  className="archive-row"
                  aria-label={`Scale ${id}, ${date}${played && overall !== null ? `, scored ${formatFactor(overall)}` : ", not played"}`}
                >
                  <span className="numeral" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--faint)", minWidth: 44 }}>
                    #{id}
                  </span>
                  <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: "var(--ink-soft)" }}>
                    {date}
                    {isToday && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--coral-deep)",
                          background: "#F6E3DB",
                          borderRadius: 999,
                          padding: "3px 10px",
                        }}
                      >
                        Today
                      </span>
                    )}
                  </span>
                  <span
                    className="numeral"
                    style={{
                      fontFamily: played ? "var(--font-display)" : "var(--font-sans)",
                      fontWeight: played ? 800 : 500,
                      fontSize: played ? 19 : 13,
                      color: played ? "var(--text)" : "var(--faint)",
                    }}
                  >
                    {played && overall !== null ? formatFactor(overall) : "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
