import Link from "next/link";
import { notFound } from "next/navigation";
import { todayNumber } from "@/lib/puzzles";
import { getGameById } from "@/lib/dailyGames";
import { GameClient } from "@/components/GameClient";

// The "not published yet" gate depends on the current date.
export const dynamic = "force-dynamic";

export default function ArchivedGamePage({ params }: { params: { id: string } }) {
  // Generated game files are the archive; pre-generation dates resolve to
  // the bundled pool game with the same id scheme.
  const game = getGameById(params.id);
  if (!game) notFound();
  if (game.number > todayNumber()) {
    return (
      <div className="wrap" style={{ paddingTop: 72, paddingBottom: 80, textAlign: "center" }}>
        <p className="pill numeral" style={{ margin: "0 0 20px" }}>Scale #{params.id}</p>
        <h1 className="display" style={{ fontSize: "clamp(30px, 5vw, 40px)", margin: "0 0 12px" }}>
          Not published yet.
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15 }}>
          Today&rsquo;s game is waiting instead.{" "}
          <Link href="/play" style={{ color: "var(--coral-deep)", fontWeight: 600 }}>Play today</Link>
        </p>
      </div>
    );
  }
  // Key by game so state never leaks between archive entries.
  return <GameClient key={game.id} game={game} />;
}
