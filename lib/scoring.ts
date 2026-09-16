/**
 * Multiplicative scoring.
 * factor = max(guess / answer, answer / guess). A perfect estimate scores 1x.
 * Daily score = geometric mean of the three factors.
 */

export function scoreFactor(guess: number, answer: number): number {
  if (!Number.isFinite(guess) || !Number.isFinite(answer)) return NaN;
  if (answer <= 0 || guess <= 0) return NaN;
  return Math.max(guess / answer, answer / guess);
}

export function overallScore(factors: number[]): number {
  if (factors.length === 0) return NaN;
  if (factors.some((f) => !Number.isFinite(f) || f < 1)) return NaN;
  const product = factors.reduce((acc, f) => acc * f, 1);
  return Math.pow(product, 1 / factors.length);
}

export type Direction = "high" | "low" | "exact";

export function directionOf(guess: number, answer: number): Direction {
  if (guess === answer) return "exact";
  return guess > answer ? "high" : "low";
}

export function formatFactor(f: number): string {
  if (!Number.isFinite(f)) return "—";
  if (f < 9.95) return `${trimZeros(f.toFixed(2))}×`;
  if (f < 99.5) return `${trimZeros(f.toFixed(1))}×`;
  if (f < 9950) return `${Math.round(f).toLocaleString("en-US")}×`;
  return `${compact(f)}×`;
}

function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

function compact(n: number): string {
  // Q = quadrillion (1e15). Factors can be enormous on wild guesses.
  if (n >= 1e15) return `${trimZeros((n / 1e15).toFixed(1))}Q`;
  if (n >= 1e12) return `${trimZeros((n / 1e12).toFixed(1))}T`;
  if (n >= 1e9) return `${trimZeros((n / 1e9).toFixed(1))}B`;
  if (n >= 1e6) return `${trimZeros((n / 1e6).toFixed(1))}M`;
  if (n >= 1e3) return `${trimZeros((n / 1e3).toFixed(1))}k`;
  return String(Math.round(n));
}

