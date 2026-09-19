// GENERATED from src/lib/game/words.ts by scripts/build-edge-function.mjs.
// Do not edit — change the original and run `npm run build:edge`.

import type { Difficulty } from "./scoring.ts";
import { normalizeWord, shuffle } from "./text.ts";

export interface WordEntry {
  word: string;
  difficulty: Difficulty;
  category: string;
}

type Grouped = Record<string, Partial<Record<Difficulty, string[]>>>;

function flatten(groups: Grouped): WordEntry[] {
  const out: WordEntry[] = [];
  for (const [category, tiers] of Object.entries(groups)) {
    for (const [difficulty, words] of Object.entries(tiers)) {
      for (const word of words ?? []) {
        out.push({ word, difficulty: difficulty as Difficulty, category });
      }
    }
  }
  return out;
}

const SIMPLE: Grouped = {
  animals: {
    easy: ["cat", "dog", "fish", "bird", "cow", "pig", "duck", "bee", "frog", "owl", "bat", "crab"],
    medium: ["rabbit", "monkey", "turtle", "penguin", "giraffe", "octopus", "squirrel", "dolphin", "hedgehog", "flamingo"],
    hard: ["chameleon", "rhinoceros", "jellyfish", "caterpillar", "grasshopper", "orangutan", "porcupine"],
  },
  food: {
    easy: ["apple", "pizza", "cake", "egg", "corn", "milk", "taco", "pear", "bread", "soup"],
    medium: ["banana", "popcorn", "pancake", "cupcake", "burger", "noodles", "sandwich", "pineapple", "watermelon"],
    hard: ["spaghetti", "strawberry", "marshmallow", "gingerbread", "cheeseburger"],
  },
  objects: {
    easy: ["ball", "book", "cup", "hat", "key", "shoe", "kite", "drum", "bell", "sock", "spoon", "clock"],
    medium: ["camera", "guitar", "pencil", "backpack", "toothbrush", "scissors", "umbrella", "ladder", "balloon", "bicycle"],
    hard: ["telescope", "typewriter", "skateboard", "helicopter", "lighthouse", "wheelbarrow"],
  },
  nature: {
    easy: ["sun", "moon", "tree", "star", "rain", "leaf", "rock", "snow", "cloud", "fire"],
    medium: ["rainbow", "volcano", "island", "cactus", "mountain", "river", "sunflower", "iceberg"],
    hard: ["waterfall", "tornado", "constellation", "avalanche"],
  },
  places: {
    easy: ["house", "tent", "farm", "park", "boat", "train", "castle"],
    medium: ["airport", "library", "treehouse", "playground", "windmill", "igloo", "campsite"],
    hard: ["amusement park", "space station", "submarine", "skyscraper"],
  },
  actions: {
    easy: ["run", "jump", "swim", "sleep", "dance", "sing"],
    medium: ["juggling", "surfing", "skiing", "fishing", "camping", "painting"],
    hard: ["skydiving", "tightrope", "snorkelling", "gardening"],
  },
};

const TRICKY: Grouped = {
  idioms: {
    easy: ["cold feet", "big fish", "hot dog"],
    medium: ["couch potato", "break the ice", "spill the beans", "piece of cake", "cat nap", "night owl"],
    hard: ["raining cats and dogs", "elephant in the room", "burning the midnight oil", "bull in a china shop", "under the weather"],
  },
  abstract: {
    easy: ["love", "time", "luck", "noise"],
    medium: ["gravity", "memory", "silence", "jealousy", "deadline", "nostalgia", "karma"],
    hard: ["procrastination", "existential crisis", "imposter syndrome", "inflation", "bureaucracy", "midlife crisis"],
  },
  culture: {
    easy: ["selfie", "podcast", "emoji", "meme"],
    medium: ["time machine", "rock band", "superhero", "zombie movie", "road trip", "karaoke"],
    hard: ["mad scientist", "conspiracy theory", "parallel universe", "escape room", "haunted mansion"],
  },
  everyday: {
    easy: ["coffee", "traffic", "laundry"],
    medium: ["group chat", "open floor plan", "flat tyre", "jury duty", "spring cleaning"],
    hard: ["office small talk", "assembly instructions", "airport security", "tax return"],
  },
};

const GENZ: Grouped = {
  vibes: {
    easy: ["vibe", "mood", "slay", "flex", "drip", "ick", "bop", "salty"],
    medium: ["based", "extra", "cringe", "bussin"],
  },
  reactions: {
    easy: ["bet", "sus", "tea", "mid"],
    medium: ["ratio", "bruh", "no cap", "side eye"],
  },
  online: {
    medium: ["clout", "rizz", "ghosted", "glow up"],
    hard: ["brainrot", "doomscroll", "soft launch", "npc energy"],
  },
  life: {
    hard: ["delulu", "red flag", "beige flag", "side quest", "touch grass", "main character", "situationship", "caught in 4k"],
  },
};

export const SIMPLE_PACK: WordEntry[] = flatten(SIMPLE);
export const TRICKY_PACK: WordEntry[] = flatten(TRICKY);
export const GENZ_PACK: WordEntry[] = flatten(GENZ);
export const MIXED_PACK: WordEntry[] = [...SIMPLE_PACK, ...TRICKY_PACK];

export type PackId = "simple" | "tricky" | "genz" | "mixed" | "custom";

export function builtinPack(id: PackId): WordEntry[] {
  if (id === "tricky") return TRICKY_PACK;
  if (id === "genz") return GENZ_PACK;
  if (id === "mixed") return MIXED_PACK;
  return SIMPLE_PACK;
}

export function entriesFromCustomWords(words: readonly string[]): WordEntry[] {
  const seen = new Set<string>();
  const out: WordEntry[] = [];
  for (const raw of words) {
    const word = raw.replace(/\s+/g, " ").trim().toLowerCase();
    if (word.length < 2 || word.length > 32) continue;
    const key = normalizeWord(word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const length = key.replace(/\s/g, "").length;
    const difficulty: Difficulty = length <= 5 ? "easy" : length <= 9 ? "medium" : "hard";
    out.push({ word, difficulty, category: "custom" });
  }
  return out;
}

export interface WordChoice {
  word: string;
  difficulty: Difficulty;
  category: string;
}

export function drawWordChoices(
  pool: readonly WordEntry[],
  rng: () => number,
  usedWords: readonly string[] = [],
): WordChoice[] {
  const used = new Set(usedWords.map(normalizeWord));
  const fresh = pool.filter((e) => !used.has(normalizeWord(e.word)));
  const available = fresh.length >= 3 ? fresh : pool.slice();
  const tiers: Difficulty[] = ["easy", "medium", "hard"];
  const chosen: WordChoice[] = [];
  const taken = new Set<string>();

  for (const tier of tiers) {
    const bucket = shuffle(available.filter((e) => e.difficulty === tier && !taken.has(e.word)), rng);
    if (bucket.length) {
      chosen.push(bucket[0]);
      taken.add(bucket[0].word);
    }
  }
  if (chosen.length < 3) {
    for (const entry of shuffle(available, rng)) {
      if (chosen.length >= 3) break;
      if (taken.has(entry.word)) continue;
      chosen.push(entry);
      taken.add(entry.word);
    }
  }
  return chosen;
}

export function rotateCategories(pool: readonly WordEntry[], rng: () => number, keep = 4): WordEntry[] {
  const categories = Array.from(new Set(pool.map((e) => e.category)));
  if (categories.length <= keep) return pool.slice();
  const picked = new Set(shuffle(categories, rng).slice(0, keep));
  return pool.filter((e) => picked.has(e.category));
}
