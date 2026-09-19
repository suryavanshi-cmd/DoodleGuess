// GENERATED from src/lib/game/synonyms.ts by scripts/build-edge-function.mjs.
// Do not edit — change the original and run `npm run build:edge`.

import { normalizeWord } from "./text.ts";

const NEAR_SYNONYMS: Record<string, string[]> = {
  cat: ["kitten", "kitty", "feline"],
  dog: ["puppy", "pup", "hound", "canine"],
  fish: ["goldfish", "trout", "salmon"],
  bird: ["sparrow", "robin", "parrot"],
  cow: ["cattle", "calf", "bull"],
  pig: ["piglet", "hog", "swine"],
  duck: ["duckling", "goose"],
  bee: ["bumblebee", "honeybee", "wasp"],
  frog: ["toad", "tadpole"],
  owl: ["barn owl"],
  bat: ["fruit bat"],
  rabbit: ["bunny", "hare"],
  monkey: ["ape", "chimp", "chimpanzee"],
  turtle: ["tortoise"],
  octopus: ["squid"],
  squirrel: ["chipmunk"],
  dolphin: ["porpoise"],
  jellyfish: ["jelly"],
  caterpillar: ["grub", "larva"],
  grasshopper: ["cricket", "locust"],
  orangutan: ["ape"],
  porcupine: ["hedgehog"],
  rhinoceros: ["rhino"],
  apple: ["fruit"],
  pizza: ["pie"],
  cake: ["cupcake", "gateau"],
  corn: ["maize", "sweetcorn"],
  taco: ["burrito"],
  bread: ["loaf", "toast"],
  soup: ["broth", "stew"],
  burger: ["hamburger", "cheeseburger"],
  noodles: ["pasta", "spaghetti"],
  sandwich: ["sub", "roll"],
  cupcake: ["muffin"],
  pancake: ["crepe"],
  ball: ["sphere"],
  book: ["novel"],
  cup: ["mug", "glass"],
  hat: ["cap", "beanie"],
  shoe: ["sneaker", "boot", "trainer"],
  kite: ["glider"],
  bell: ["chime"],
  sock: ["stocking"],
  spoon: ["ladle"],
  clock: ["watch", "timer"],
  camera: ["polaroid"],
  pencil: ["pen"],
  backpack: ["rucksack", "bag"],
  scissors: ["shears"],
  umbrella: ["parasol"],
  ladder: ["stepladder"],
  balloon: ["blimp"],
  bicycle: ["bike", "cycle"],
  telescope: ["binoculars"],
  skateboard: ["longboard"],
  helicopter: ["chopper"],
  lighthouse: ["beacon"],
  wheelbarrow: ["cart"],
  sun: ["sunshine", "sunlight"],
  moon: ["crescent"],
  tree: ["oak", "pine"],
  star: ["starlight"],
  rain: ["drizzle", "shower"],
  leaf: ["foliage"],
  rock: ["stone", "boulder", "pebble"],
  snow: ["snowflake", "blizzard"],
  cloud: ["fog", "mist"],
  fire: ["flame", "campfire", "bonfire"],
  rainbow: ["prism"],
  volcano: ["eruption"],
  island: ["isle", "atoll"],
  cactus: ["succulent"],
  mountain: ["hill", "peak", "summit"],
  river: ["stream", "creek"],
  sunflower: ["flower"],
  iceberg: ["glacier"],
  waterfall: ["falls", "cascade"],
  tornado: ["twister", "cyclone"],
  avalanche: ["landslide"],
  house: ["home", "cottage"],
  tent: ["marquee"],
  farm: ["ranch"],
  park: ["garden"],
  boat: ["ship", "canoe", "yacht"],
  train: ["locomotive", "railway"],
  castle: ["fortress", "palace"],
  airport: ["terminal", "runway"],
  library: ["bookshop"],
  playground: ["park"],
  windmill: ["turbine"],
  igloo: ["snow house"],
  campsite: ["campground"],
  submarine: ["sub", "u boat"],
  skyscraper: ["tower", "high rise"],
  run: ["sprint", "jog", "dash"],
  jump: ["leap", "hop", "bounce"],
  swim: ["dive", "paddle"],
  sleep: ["nap", "snooze", "doze"],
  dance: ["boogie", "waltz"],
  sing: ["chant", "hum"],
  juggling: ["juggle"],
  surfing: ["surf"],
  skiing: ["ski", "snowboarding"],
  fishing: ["angling"],
  camping: ["camp"],
  painting: ["paint", "art"],
  skydiving: ["parachuting", "base jumping"],
  tightrope: ["highwire"],
  gardening: ["weeding", "planting"],
  selfie: ["self portrait"],
  podcast: ["radio show"],
  emoji: ["emoticon", "smiley"],
  meme: ["viral post"],
  superhero: ["hero", "caped crusader"],
  karaoke: ["sing along"],
  coffee: ["espresso", "latte", "brew"],
  traffic: ["jam", "gridlock"],
  laundry: ["washing"],
  love: ["affection", "romance"],
  time: ["hours", "clockwork"],
  luck: ["fortune", "chance"],
  noise: ["sound", "racket", "din"],
  gravity: ["weight"],
  memory: ["recollection", "remembrance"],
  silence: ["quiet", "hush"],
  jealousy: ["envy"],
  deadline: ["due date", "cutoff"],
  nostalgia: ["homesickness"],
  karma: ["fate", "destiny"],
  inflation: ["price rise"],
  bureaucracy: ["red tape", "paperwork"],
  procrastination: ["delay", "dithering"],
  "cold feet": ["nerves", "second thoughts"],
  "couch potato": ["slacker", "layabout"],
  "night owl": ["insomniac"],
  "piece of cake": ["easy", "doddle"],
  "road trip": ["drive"],
  "time machine": ["time travel"],
  "escape room": ["puzzle room"],
};

function buildIndex(): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    const key = normalizeWord(a);
    if (!index.has(key)) index.set(key, new Set());
    index.get(key)!.add(normalizeWord(b));
  };
  for (const [word, list] of Object.entries(NEAR_SYNONYMS)) {
    for (const synonym of list) {
      link(word, synonym);
      link(synonym, word);

      for (const other of list) if (other !== synonym) link(synonym, other);
    }
  }
  return index;
}

const INDEX = buildIndex();

export function isSynonym(guess: string, word: string): boolean {
  const a = normalizeWord(guess);
  const b = normalizeWord(word);
  if (!a || !b || a === b) return false;
  return INDEX.get(b)?.has(a) ?? false;
}

export function synonymsOf(word: string): string[] {
  return [...(INDEX.get(normalizeWord(word)) ?? [])];
}

export const SYNONYM_ENTRY_COUNT = INDEX.size;
