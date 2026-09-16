/** Number parsing + display formatting. */

const SUFFIXES: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  t: 1e12,
};

export interface ParseResult {
  ok: boolean;
  value: number;
  error?: string;
}

export function parseEstimate(raw: string): ParseResult {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!cleaned) return { ok: false, value: NaN, error: "Enter a number first." };

  const match = cleaned.match(/^(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([kmbt])?$/);
  if (!match) {
    return {
      ok: false,
      value: NaN,
      error: "That doesn't look like a number. Try 1200, 1.2k or 2.4m.",
    };
  }
  let value = parseFloat(match[1]);
  if (match[2]) value *= SUFFIXES[match[2]];
  if (!Number.isFinite(value)) {
    return { ok: false, value: NaN, error: "That number is too large." };
  }
  if (value <= 0) {
    return { ok: false, value: NaN, error: "Estimates must be above zero." };
  }
  if (value > 1e18) {
    return { ok: false, value: NaN, error: "That number is too large." };
  }
  return { ok: true, value };
}

export function formatFull(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && (Math.abs(n) >= 1e15 || Math.abs(n) < 1e-6)) {
    return n.toExponential(1).replace("e+", "×10^");
  }
  const [int, dec] = String(n).split(".");
  const grouped = Number(int).toLocaleString("en-US");
  if (dec === undefined) return grouped;
  return `${grouped}.${dec.slice(0, 4)}`;
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const trim = (s: string) => (s.includes(".") ? s.replace(/\.?0+$/, "") : s);
  // Q = quadrillion (1e15). Keeps huge answers (e.g. ants) readable.
  if (abs >= 1e15) return `${trim((n / 1e15).toFixed(1))}Q`;
  if (abs >= 1e12) return `${trim((n / 1e12).toFixed(2))}T`;
  if (abs >= 1e9) return `${trim((n / 1e9).toFixed(2))}B`;
  if (abs >= 1e6) return `${trim((n / 1e6).toFixed(2))}M`;
  if (abs >= 1e3) return `${trim((n / 1e3).toFixed(2))}k`;
  if (abs >= 100) return trim(n.toFixed(n < 1000 ? 1 : 0));
  if (abs >= 1) return trim(n.toFixed(2));
  return String(n);
}
