"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { todayISO } from "@/lib/puzzles";

/**
 * Around the daily rollover, a tab left open would otherwise keep showing
 * yesterday's game indefinitely. When the tab regains focus (or becomes
 * visible) on a new local day, refresh the server-rendered game.
 * No polling, no network calls of our own — just a router refresh.
 */
export function RolloverRefresh({ dateISO }: { dateISO: string }) {
  const router = useRouter();
  const seen = useRef(dateISO);

  useEffect(() => {
    seen.current = dateISO;
    const check = () => {
      if (document.visibilityState === "hidden") return;
      if (todayISO(new Date()) !== seen.current) {
        router.refresh();
      }
    };
    const onVis = () => check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [dateISO, router]);

  return null;
}
