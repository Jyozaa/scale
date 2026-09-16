import Link from "next/link";
import { gameForDate, todayISO, padId, formatDateLabel } from "@/lib/puzzles";
import { PlayButton } from "@/components/PlayButton";
import { RolloverRefresh } from "@/components/RolloverRefresh";

// Today's game depends on the current date — never prerender stale.
export const dynamic = "force-dynamic";

export default function Home() {
  const iso = todayISO(new Date());
  const game = gameForDate(iso);

  return (
    <div
      className="wrap"
      style={{
        paddingTop: "clamp(72px, 12vh, 128px)",
        paddingBottom: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <p
        className="label numeral"
        style={{ margin: 0 }}
      >
        Today&rsquo;s game
      </p>
      <p
        className="display numeral"
        style={{ margin: "14px 0 0", fontSize: "clamp(56px, 10vw, 84px)", lineHeight: 1 }}
      >
        #{padId(game.number)}
      </p>
      <p className="numeral" style={{ margin: "12px 0 0", fontSize: 14.5, color: "var(--muted)" }}>
        {formatDateLabel(iso)} · 3 questions
      </p>
      <div style={{ marginTop: 40 }}>
        <PlayButton />
      </div>
      <div style={{ marginTop: 20 }}>
        <Link href="/archive" className="nav-link" style={{ fontSize: 14.5 }}>
          Archive
        </Link>
      </div>
      <RolloverRefresh dateISO={iso} />
    </div>
  );
}
