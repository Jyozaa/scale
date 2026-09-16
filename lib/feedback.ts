import { hashSeed } from "./seededRandom";
import type { Direction } from "./scoring";

export type FeedbackTier =
  | "perfect"
  | "great"
  | "good"
  | "okay"
  | "bad"
  | "terrible"
  | "catastrophic";

export function tierForFactor(factor: number): FeedbackTier {
  if (!Number.isFinite(factor)) return "okay";
  if (factor <= 1.1) return "perfect";
  if (factor <= 1.5) return "great";
  if (factor <= 2) return "good";
  if (factor <= 5) return "okay";
  if (factor <= 10) return "bad";
  if (factor <= 100) return "terrible";
  return "catastrophic";
}

const feedback: Record<FeedbackTier, string[]> = {
  perfect: [
    "You got lucky this time.",
    "Suspiciously accurate.",
    "Alright, show-off.",
    "Did you already know that?",
    "Beginner's luck. Probably.",
    "That's annoyingly good.",
    "Fine. I'll give you that one.",
    "Way too confident for someone guessing.",
  ],
  great: [
    "Okay, that was actually decent.",
    "Not bad. Don't let it go to your head.",
    "You almost look like you know things.",
    "Respectable. Unfortunately.",
    "That guess had no business being that close.",
    "Fine. You can have this one.",
    "Suspiciously competent.",
    "Keep that up and I'll get worried.",
  ],
  good: [
    "Close enough to pretend you knew.",
    "I've seen worse.",
    "Technically respectable.",
    "You survived.",
    "Not brilliant. Not embarrassing either.",
    "Somehow, that worked.",
    "Acceptable. Barely worth mentioning.",
    "A respectable wobble.",
  ],
  okay: [
    "Well… you're in the same universe.",
    "At least you understood the assignment.",
    "Could've been worse. Easily.",
    "I'll call that a guess.",
    "Bold. Questionable, but bold.",
    "Somewhere in the neighbourhood. Sort of.",
    "You're orbiting the answer.",
    "Not lost. Just… exploring.",
  ],
  bad: [
    "Interesting interpretation of numbers.",
    "That was certainly a number.",
    "Have you considered guessing closer?",
    "Confidence: high. Accuracy: unavailable.",
    "The calculator was right there.",
    "That went well.",
    "You missed. By quite a bit.",
    "So close. To a different answer.",
  ],
  terrible: [
    "Were you estimating or just pressing keys?",
    "Impressive. In the wrong direction.",
    "That number came from somewhere.",
    "At least you committed to it.",
    "We'll pretend nobody saw that.",
    "Maybe numbers aren't your thing today.",
    "Spectacularly incorrect.",
    "That guess had main-character energy.",
  ],
  catastrophic: [
    "That wasn't even the same postcode.",
    "Have you ever encountered a number before?",
    "Absolutely fearless. Completely wrong.",
    "You've discovered a new order of magnitude.",
    "The answer has filed a restraining order.",
    "That guess needs adult supervision.",
    "Statistically, guessing with your eyes closed might help.",
    "Outstanding confidence. Historic accuracy.",
  ],
};

const HISTORY_KEY = "scale.feedbackHistory";
const HISTORY_LIMIT = 20;

function readHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function appendHistory(phrase: string): void {
  if (typeof window === "undefined") return;
  try {
    const h = readHistory();
    h.push(phrase);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-HISTORY_LIMIT)));
  } catch {
    // storage unavailable — variety still works per-session
  }
}

/**
 * Deterministic phrase per game + question + tier, stable across refresh.
 * Skips recently shown phrases (last 20) for variety.
 */
export function phraseFor(gameId: string, questionIndex: number, factor: number): string {
  const tier = tierForFactor(factor);
  const list = feedback[tier];
  const seed = hashSeed(`${gameId}-q${questionIndex}-${tier}`) >>> 0;
  const start = seed % list.length;

  if (typeof window === "undefined") return list[start];

  const history = new Set(readHistory());
  for (let k = 0; k < list.length; k++) {
    const candidate = list[(start + k) % list.length];
    if (!history.has(candidate)) {
      appendHistory(candidate);
      return candidate;
    }
  }
  // All recently seen — reuse deterministic pick without recording twice.
  return list[start];
}

/** Short verdict line under the factor. Direction-aware for misses. */
export function verdictFor(tier: FeedbackTier, dir: Direction): string {
  if (dir === "exact") return "exactly right";
  const high = dir === "high";
  switch (tier) {
    case "perfect":
      return "basically spot on";
    case "great":
      return high ? "just a touch high" : "just a touch low";
    case "good":
      return high ? "a little high" : "a little low";
    case "okay":
      return high ? "too high" : "too low";
    case "bad":
      return high ? "way too high" : "way too low";
    case "terrible":
      return high ? "way, way too high" : "way, way too low";
    case "catastrophic":
      return "not even close";
  }
}

/** Rare deadpan emoji — most results get none. Deterministic per game. */
export function emojiFor(gameId: string, questionIndex: number, tier: FeedbackTier): string {
  const seed = hashSeed(`${gameId}-q${questionIndex}-emoji-${tier}`) >>> 0;
  if (tier === "perfect") return seed % 3 === 0 ? "😏" : "";
  if (tier === "great") return seed % 4 === 0 ? "🎉" : "";
  if (tier === "terrible") return seed % 3 === 0 ? "🫠" : "";
  if (tier === "catastrophic") return seed % 3 === 0 ? "💀" : "";
  if (tier === "bad") return seed % 5 === 0 ? "🤨" : "";
  return "";
}

/** One small category emoji at most, derived from prompt keywords. */
export function categoryFor(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/(planet|solar|star|galaxy|sunlight|sun\b|moon|space|tree|ant|ocean|earth|climate|water|forest)/.test(p)) return "🌍";
  if (/(railway|train|flight|airport|heathrow|marathon|runner|bicycle|wall of china|eiffel|bridge)/.test(p)) return "🚆";
  if (/(coffee|tea|calorie|big mac|food|drink|cup)/.test(p)) return "☕";
  if (/(city|tokyo|greece|countr|africa|librar|empire|brick|island|people|population|visit)/.test(p)) return "🏙️";
  if (/(heart|beat|bone|body|blood|step|human|brain|language|word)/.test(p)) return "🧠";
  if (/(basketball|football|sport|olympic|game|marathon)/.test(p)) return "🏀";
  if (/(youtube|video|sms|letter|computer|software|internet|phone)/.test(p)) return "💻";
  if (/(second|year|minute|mount|everest|kilometre|metre)/.test(p)) return "🌱";
  return "";
}
