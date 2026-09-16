import { SHARE_URL_BASE } from "./puzzles";
import { formatFactor } from "./scoring";

export interface ShareLine {
  factor: number;
  high: boolean;
  exact: boolean;
}

/** Minimal share text. Arrows only — no emoji clutter. */
export function buildShareText(
  gameNumber: number,
  overall: number,
  lines: ShareLine[]
): string {
  const id = String(gameNumber).padStart(3, "0");
  const rows = lines
    .map((l, i) => {
      const n = `0${i + 1}`;
      const arrow = l.exact ? "=" : l.high ? "↑" : "↓";
      return `${n}  ${arrow} ${formatFactor(l.factor)}`;
    })
    .join("\n");
  return `Scale #${id}\n${formatFactor(overall)}\n\n${rows}\n\n${SHARE_URL_BASE}`;
}

type NavigatorWithShare = Navigator & {
  share?: (data: { text: string }) => Promise<void>;
};

export async function shareResult(
  text: string
): Promise<"shared" | "copied" | "failed" | "cancelled"> {
  if (typeof navigator !== "undefined") {
    const nav = navigator as NavigatorWithShare;
    if (typeof nav.share === "function") {
      try {
        await nav.share({ text });
        return "shared";
      } catch (e) {
        // User dismissed the share sheet — not an error, just go back to idle.
        if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      }
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
