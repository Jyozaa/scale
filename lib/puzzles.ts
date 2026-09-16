import { mulberry32, hashSeed } from "./seededRandom";

export interface PuzzleQuestion {
  prompt: string;
  answer: number;
  unit: string;
  explanation: string;
  source?: string;
  /** Present on questions loaded from generated game files. */
  id?: string;
  category?: string;
  difficulty?: number;
}

export interface DailyGame {
  id: string;
  number: number;
  date: string; // ISO yyyy-mm-dd
  dateLabel: string;
  questions: PuzzleQuestion[];
}

export const QUESTION_POOL: PuzzleQuestion[] = [
  {
    prompt: "How many steps does the average adult take in a day?",
    answer: 7500,
    unit: "steps",
    explanation:
      "A brisk 30-minute walk is about 3,500 steps. Add pottering around home, work and errands and most studies land between 5,000 and 8,000.",
  },
  {
    prompt: "How many litres of water does one person use at home each day?",
    answer: 140,
    unit: "litres",
    explanation:
      "One shower is ~60 litres and a few toilet flushes add ~30 more. Cooking, laundry and taps make up the rest — roughly one full bathtub.",
  },
  {
    prompt: "How many commercial flights take off around the world each day?",
    answer: 100000,
    unit: "flights",
    explanation:
      "The busiest airports handle ~1,500 departures a day each, and there are thousands of airports. Trackers typically count 90,000–110,000 daily flights.",
  },
  {
    prompt: "How many kilometres of railway track are there in Great Britain?",
    answer: 16000,
    unit: "kilometres",
    explanation:
      "Britain is ~1,000 km end to end. A dense web of main lines plus branches multiplies that length roughly fifteen-fold.",
  },
  {
    prompt: "How many people visit the Eiffel Tower each year?",
    answer: 6000000,
    unit: "visitors",
    explanation:
      "About 16,000 visitors a day on average — fewer in winter, far more in summer. Multiply by 365 and you land near six million.",
  },
  {
    prompt: "How many cups of coffee are drunk worldwide each day?",
    answer: 2000000000,
    unit: "cups",
    explanation:
      "Roughly a billion coffee drinkers on Earth, averaging about two cups each. It is one of the most consumed drinks on the planet.",
  },
  {
    prompt: "How many stars are in the Milky Way?",
    answer: 200000000000,
    unit: "stars",
    explanation:
      "Astronomers weigh the galaxy by its light and motion, then divide by a typical star's mass. Estimates range from 100 to 400 billion.",
  },
  {
    prompt: "How many minutes does sunlight take to reach the Earth?",
    answer: 8,
    unit: "minutes",
    explanation:
      "Light travels 300,000 km per second and the Sun is ~150 million km away. Divide the two and you get just over 8 minutes.",
  },
  {
    prompt: "How many bricks are in the Empire State Building?",
    answer: 10000000,
    unit: "bricks",
    explanation:
      "The tower has about 200,000 cubic feet of masonry set into its steel frame. A standard brick plus mortar fills roughly that volume ten million times over.",
  },
  {
    prompt: "How many public library outlets are there in the United States?",
    answer: 16000,
    unit: "libraries",
    explanation:
      "There are ~3,000 counties in the US, each with a handful of branches on average. The official count of outlets is a little over 16,000.",
  },
  {
    prompt: "How many languages are spoken in the world?",
    answer: 7000,
    unit: "languages",
    explanation:
      "Linguists catalogue roughly seven thousand living languages — though a few dozen dominate, and hundreds have fewer than a thousand speakers left.",
  },
  {
    prompt: "How many times does a human heart beat in a day?",
    answer: 100000,
    unit: "beats",
    explanation:
      "About 70 beats a minute, times 60 minutes, times 24 hours: 70 × 60 × 24 ≈ 100,800. Your heart beats around a hundred thousand times before each sunrise.",
  },
  {
    prompt: "How many bicycles are there in the Netherlands?",
    answer: 23000000,
    unit: "bicycles",
    explanation:
      "The Dutch own more bikes than there are people — about 1.3 per person across 17.5 million residents. Cycling truly outnumbers the population.",
  },
  {
    prompt: "How many people live in the Tokyo metropolitan area?",
    answer: 37000000,
    unit: "people",
    explanation:
      "Greater Tokyo holds about a third of Japan's population. It is the largest urban area on Earth — more people than all of Canada.",
  },
  {
    prompt: "How many islands does Greece have?",
    answer: 6000,
    unit: "islands",
    explanation:
      "Only ~200 are inhabited, but cartographers count every rocky islet. The official tally falls somewhere between 1,200 and 6,000 depending on definition — six thousand is the widely cited figure.",
  },
  {
    prompt: "How many calories are in a Big Mac?",
    answer: 550,
    unit: "calories",
    explanation:
      "Two patties (~500 kcal of beef), a bun (~150) and sauce plus cheese — minus a little rounding in the official tables. A full meal with fries and a drink is roughly double.",
  },
  {
    prompt: "How many kilometres of blood vessels are in the human body?",
    answer: 100000,
    unit: "kilometres",
    explanation:
      "Arteries and veins are only the start — billions of capillaries do most of the length. Laid end to end they would circle the Earth more than twice.",
  },
  {
    prompt: "How high is Mount Everest, in metres?",
    answer: 8849,
    unit: "metres",
    explanation:
      "Commercial airliners cruise at ~11,000 m, and Everest reaches about four-fifths of that. The 2020 survey fixed it at 8,848.86 m.",
  },
  {
    prompt: "How many seconds are in a year?",
    answer: 31536000,
    unit: "seconds",
    explanation:
      "60 × 60 × 24 × 365 = 31,536,000. A handy trick: π × 10⁷ ≈ 31.4 million gets you within half a percent.",
  },
  {
    prompt: "How many trees are on Earth?",
    answer: 3000000000000,
    unit: "trees",
    explanation:
      "Satellite surveys plus ground plots suggest ~400 trees per person across 8 billion people. Forests still outnumber us enormously.",
  },
  {
    prompt: "How many ants are on Earth?",
    answer: 20000000000000000,
    unit: "ants",
    explanation:
      "About 2.5 million ants for every human. Ecologists reached this by sampling leaf litter worldwide and scaling up — the total biomass rivals humanity's.",
  },
  {
    prompt: "How many words are in the English language?",
    answer: 170000,
    unit: "words",
    explanation:
      "The Oxford English Dictionary lists ~170,000 words in current use. An educated adult actively uses only 20,000–30,000 of them.",
  },
  {
    prompt: "How many countries are there in Africa?",
    answer: 54,
    unit: "countries",
    explanation:
      "Africa has 54 fully recognised states — more than any other continent. The world total is 195, so Africa holds over a quarter of them.",
  },
  {
    prompt: "How many bones are in the adult human body?",
    answer: 206,
    unit: "bones",
    explanation:
      "Babies start with ~300, but many fuse as we grow. Half of the adult total sits in the hands and feet alone.",
  },
  {
    prompt: "How many minutes of video are uploaded to YouTube every minute?",
    answer: 30000,
    unit: "minutes",
    explanation:
      "Creators upload ~500 hours of video per minute — twenty days of footage every sixty seconds. Nobody could ever watch it all.",
  },
  {
    prompt: "How many passengers pass through Heathrow Airport each year?",
    answer: 80000000,
    unit: "passengers",
    explanation:
      "Roughly 220,000 a day through its terminals — a mid-sized city taking flight daily. It is Europe's busiest airport.",
  },
  {
    prompt: "How long is the Great Wall of China, in kilometres?",
    answer: 21000,
    unit: "kilometres",
    explanation:
      "All branches and trenches measured together stretch halfway around the Earth. Walking it end to end would take well over a year.",
  },
  {
    prompt: "How many runners finish the London Marathon each year?",
    answer: 50000,
    unit: "runners",
    explanation:
      "Around 50,000–55,000 finishers stream across Tower Bridge each spring — running shoulder to shoulder for most of the 42 kilometres.",
  },
  {
    prompt: "How many cups of tea are drunk in Britain each day?",
    answer: 100000000,
    unit: "cups",
    explanation:
      "About 67 million residents averaging well over a cup each — builders' brews, afternoon teas and everything between. The kettle rarely rests.",
  },
  {
    prompt: "How many letters fit in a standard SMS message?",
    answer: 160,
    unit: "characters",
    explanation:
      "The 160-character limit came from a 1980s engineer's test message format — short enough to fit the signalling channel, long enough for a thought.",
  },
];

const LAUNCH_DATE = "2026-07-01";
export const SHARE_URL_BASE = "https://scale.game";

function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function launchDay(): Date {
  return parseDay(LAUNCH_DATE);
}

export function todayISO(now: Date = new Date()): string {
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function numberForDate(dateISO: string): number {
  const ms = parseDay(dateISO).getTime() - launchDay().getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export function dateForNumber(n: number): string {
  const d = new Date(launchDay().getTime() + (n - 1) * 86400000);
  return toISO(d);
}

export function todayNumber(now: Date = new Date()): number {
  return numberForDate(todayISO(now));
}

export function formatDateLabel(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

export function padId(n: number): string {
  return String(n).padStart(3, "0");
}

export function gameForNumber(n: number): DailyGame {
  const rng = mulberry32(hashSeed(`scale-game-${n}`));
  const idx = QUESTION_POOL.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const questions = idx.slice(0, 3).map((i) => QUESTION_POOL[i]);
  const date = dateForNumber(n);
  return {
    id: padId(n),
    number: n,
    date,
    dateLabel: formatDateLabel(date),
    questions,
  };
}

export function gameForId(id: string): DailyGame | null {
  if (!/^\d+$/.test(id)) return null;
  const n = parseInt(id, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return gameForNumber(n);
}

export function gameForDate(dateISO: string): DailyGame {
  return gameForNumber(numberForDate(dateISO));
}
