import { todayISO } from "@/lib/puzzles";
import { getDailyGame } from "@/lib/dailyGames";
import { GameClient } from "@/components/GameClient";
import { RolloverRefresh } from "@/components/RolloverRefresh";

// Today's game depends on the current date — never prerender stale.
export const dynamic = "force-dynamic";

export default function PlayPage() {
  // Primary source: today's generated game file (data/games/*.json).
  // Falls back to the bundled pool game when no file exists for the date.
  const game = getDailyGame(todayISO(new Date()));
  // Key by game so state never leaks between days.
  return (
    <>
      <RolloverRefresh dateISO={game.date} />
      <GameClient key={game.id} game={game} />
    </>
  );
}
