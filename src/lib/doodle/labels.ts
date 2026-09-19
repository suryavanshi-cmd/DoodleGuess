/**
 * Mapping between the words this game hands out and the categories the
 * Quick, Draw! dataset was collected under.
 *
 * The two lists were written by different people for different purposes, so
 * they disagree in three ways, and each needs handling:
 *
 *  - Same thing, different name. The dataset calls a turtle a "sea turtle".
 *    That is the ALIASES table below.
 *  - The dataset simply has no such category — "rizz", "existential crisis",
 *    every abstract prompt in the Gen Z pack. Nothing can fix that, and the
 *    honest response is for the classifier to say nothing at all rather than
 *    name its nearest neighbour with total confidence.
 *  - The dataset has categories the game never serves. Harmless: solo draws
 *    its words from the model's labels, so they simply become more words.
 */

/** Letters only, so "sea turtle", "Sea Turtle" and "seaturtle" all agree. */
export function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Game word to dataset category, for the handful that differ only in name.
 * Deliberately conservative: a wrong alias is worse than a missing one,
 * because it teaches the classifier to confidently answer the wrong question.
 */
const ALIASES: Record<string, string> = {
  ball: "soccer ball",
  balloon: "hot air balloon",
  boat: "sailboat",
  burger: "hamburger",
  coffee: "coffee cup",
  drum: "drums",
  turtle: "sea turtle",
};

/** The dataset category for a game word, or the word itself when they agree. */
export function datasetCategory(word: string): string {
  return ALIASES[word.trim().toLowerCase()] ?? word;
}

/** Does this prediction name the word being drawn? Alias-aware in both directions. */
export function labelMatches(label: string, word: string | null | undefined): boolean {
  if (!word) return false;
  const target = normalizeLabel(datasetCategory(word));
  return normalizeLabel(label) === target;
}

/** Can the model say this word at all? If not, it should stay quiet. */
export function modelKnows(labels: readonly string[], word: string | null | undefined): boolean {
  if (!word) return false;
  const target = normalizeLabel(datasetCategory(word));
  return labels.some((label) => normalizeLabel(label) === target);
}

/**
 * Categories that make poor prompts for solo, where the word comes from the
 * model's own labels. Landmarks and a painting are not things somebody can be
 * asked to doodle in twenty seconds, and "animal migration" is not a thing at
 * all — it is a scene.
 */
const UNDRAWABLE = new Set([
  "animal migration",
  "The Eiffel Tower",
  "The Great Wall of China",
  "The Mona Lisa",
]);

/** The labels worth handing somebody as a prompt. */
export function promptableLabels(labels: readonly string[]): string[] {
  return labels.filter((label) => !UNDRAWABLE.has(label));
}
