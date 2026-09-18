"use client";

import { BASE_POINTS, type Difficulty } from "@/lib/game/scoring";

const TIER_STYLE: Record<Difficulty, string> = {
  easy: "border-success/50 bg-success/10",
  medium: "border-warning/50 bg-warning/10",
  hard: "border-danger/50 bg-danger/10",
};

export function WordPicker({ choices, onPick }: {
  choices: { word: string; difficulty: Difficulty }[];
  onPick: (index: number) => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/55 p-4 backdrop-blur-sm">
      <div className="animate-pop-in card w-full max-w-lg p-5">
        <h3 className="text-center text-xl font-bold">Your turn — pick a word</h3>
        <p className="mt-1 text-center text-sm text-muted">Harder words are worth more points.</p>
        <div className="mt-4 grid gap-2">
          {choices.map((choice, index) => (
            <button
              key={choice.word}
              type="button"
              onClick={() => onPick(index)}
              className={`btn w-full justify-between border-2 px-4 py-4 text-lg ${TIER_STYLE[choice.difficulty]}`}
            >
              <span className="font-bold">{choice.word}</span>
              <span className="text-sm font-semibold uppercase tracking-wide text-muted">
                {choice.difficulty} · {BASE_POINTS[choice.difficulty]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
