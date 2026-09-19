import type { Avatar } from "@/lib/game/types";

/**
 * The cast, and the names that come with them.
 *
 * Every character doubles as a nickname, which is what lets the front page
 * open a room in one tap and what keeps /play from ever showing a dead
 * primary button: nobody has to type anything to be somebody.
 */
export interface Character {
  emoji: string;
  /** One word, so it works as a nickname unedited. */
  name: string;
  color: string;
}

export const CHARACTERS: Character[] = [
  { emoji: "🦊", name: "Fox", color: "#f97316" },
  { emoji: "🐼", name: "Panda", color: "#14b8a6" },
  { emoji: "🐸", name: "Frog", color: "#22c55e" },
  { emoji: "🐙", name: "Octo", color: "#6366f1" },
  { emoji: "🦖", name: "Rex", color: "#eab308" },
  { emoji: "🐝", name: "Bee", color: "#f97316" },
  { emoji: "🦄", name: "Unicorn", color: "#a855f7" },
  { emoji: "🐧", name: "Penguin", color: "#06b6d4" },
  { emoji: "🐨", name: "Koala", color: "#14b8a6" },
  { emoji: "🦉", name: "Owl", color: "#ec4899" },
  { emoji: "🐳", name: "Whale", color: "#06b6d4" },
  { emoji: "🚀", name: "Rocket", color: "#6366f1" },
];

/** The name that goes with a face, for anyone who did not pick one. */
export function nameFor(avatar: Avatar): string {
  return CHARACTERS.find((character) => character.emoji === avatar.emoji)?.name ?? "Player";
}
