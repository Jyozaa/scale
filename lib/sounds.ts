"use client";

/**
 * Scale sound design — subtle, synthesized, no assets, no toggles.
 * Web Audio API only. All sounds are short, quiet, and satisfying.
 * AudioContext is created lazily on first user interaction.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended" && unlocked) {
      void ctx.resume().catch(() => undefined);
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Call once on first pointer/key interaction so later sounds may play. */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  unlocked = true;
  const c = ensureCtx();
  if (c && c.state === "suspended") {
    void c.resume().catch(() => undefined);
  }
}

if (typeof window !== "undefined") {
  const unlock = () => unlockAudio();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

interface ToneOpts {
  freqFrom: number;
  freqTo?: number;
  time?: number;
  duration?: number;
  gain?: number;
  type?: OscillatorType;
}

function tone({
  freqFrom,
  freqTo,
  time = 0,
  duration = 0.12,
  gain = 0.03,
  type = "sine",
}: ToneOpts): void {
  const c = ensureCtx();
  if (!c) return;
  if (!unlocked && c.state !== "running") return;
  try {
    const t0 = c.currentTime + time;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freqFrom), t0);
    if (freqTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t0 + duration);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch {
    // never break the game for audio
  }
}

/** Very quiet tactile click for generic UI taps. gain 0.02–0.03 */
export function playTap(): void {
  tone({ freqFrom: 620, freqTo: 520, duration: 0.06, gain: 0.025, type: "sine" });
}

/** Soft low pop for submitting a guess. */
export function playSubmit(): void {
  tone({ freqFrom: 320, freqTo: 190, duration: 0.14, gain: 0.045, type: "sine" });
  tone({ freqFrom: 640, freqTo: 560, duration: 0.05, gain: 0.015, type: "triangle", time: 0.01 });
}

/** Short pleasant chime for good results. */
export function playGoodResult(): void {
  tone({ freqFrom: 660, duration: 0.12, gain: 0.05, type: "sine" });
  tone({ freqFrom: 880, duration: 0.16, gain: 0.045, type: "sine", time: 0.09 });
}

/** Slightly brighter chime for very good / perfect results. */
export function playGreatResult(): void {
  tone({ freqFrom: 660, duration: 0.1, gain: 0.05, type: "sine" });
  tone({ freqFrom: 880, duration: 0.1, gain: 0.05, type: "sine", time: 0.08 });
  tone({ freqFrom: 1174, duration: 0.2, gain: 0.055, type: "sine", time: 0.16 });
}

/** Short soft descending bonk for bad results. */
export function playBadResult(): void {
  tone({ freqFrom: 220, freqTo: 130, duration: 0.22, gain: 0.05, type: "sine" });
  tone({ freqFrom: 110, freqTo: 82, duration: 0.2, gain: 0.02, type: "triangle", time: 0.02 });
}

/** Small transition pop for next question. */
export function playNext(): void {
  tone({ freqFrom: 440, freqTo: 560, duration: 0.08, gain: 0.03, type: "sine" });
}

/** Very short satisfying completion arpeggio. */
export function playComplete(): void {
  tone({ freqFrom: 523, duration: 0.11, gain: 0.05, type: "sine" });
  tone({ freqFrom: 659, duration: 0.11, gain: 0.05, type: "sine", time: 0.09 });
  tone({ freqFrom: 784, duration: 0.22, gain: 0.055, type: "sine", time: 0.18 });
}
