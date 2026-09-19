"use client";

import { useState } from "react";
import { CUSTOM_WORD_MAX, validateCustomWord } from "@/lib/game/customWord";
import { BASE_POINTS, type Difficulty } from "@/lib/game/scoring";
import type { PublicState } from "@/lib/game/types";

const TIER_STYLE: Record<Difficulty, string> = {
  easy: "border-success/50 bg-success/10",
  medium: "border-warning/50 bg-warning/10",
  hard: "border-danger/50 bg-danger/10",
};

export function WordPicker({ choices, onPick, allowCustom, strictFilter, customWord, onCustom, onLoadSaved }: {
  choices: { word: string; difficulty: Difficulty }[];
  onPick: (index: number) => void;
  allowCustom: boolean;
  strictFilter: boolean;
  customWord: PublicState["yourCustomWord"];
  onCustom: (word: string, save: boolean) => Promise<{ status: string } | null>;
  onLoadSaved: () => Promise<{ words: string[] } | null>;
}) {
  const [tab, setTab] = useState<"suggested" | "own">("suggested");
  const [text, setText] = useState("");
  const [save, setSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[] | null>(null);

  // The same validator the server runs, so feedback lands before the request.
  const check = text.trim() ? validateCustomWord(text, { strict: strictFilter }) : null;
  const waiting = customWord?.status === "pending";

  if (waiting) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-scrim p-4 backdrop-blur-sm lg:absolute lg:z-30 lg:rounded-2xl">
        <div className="animate-pop-in card w-full max-w-sm p-5 text-center">
          <p className="text-4xl" aria-hidden>⏳</p>
          <h3 className="mt-2 text-lg">Waiting for the host</h3>
          <p className="mt-1 text-sm text-muted">
            They are checking “<strong className="text-fg">{customWord?.word}</strong>”. If they don&apos;t
            answer, the game picks a word for you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-scrim p-3 backdrop-blur-sm lg:absolute lg:z-30 lg:rounded-2xl">
      <div className="animate-pop-in card max-h-full w-full max-w-lg overflow-y-auto p-4 sm:p-5">
        <h3 className="text-center text-lg">Your turn — pick a word</h3>

        {allowCustom ? (
          <div className="mt-3 flex rounded-xl border border-line bg-surface-2 p-1">
            {([["suggested", "Suggestions"], ["own", "Enter your own"]] as const).map(([id, label]) => (
              <button
                key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-wide transition
                  ${tab === id ? "bg-brand text-brand-fg" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {customWord?.status === "rejected" ? (
          <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            {customWord.message ?? "That word was not used — pick another."}
          </p>
        ) : null}

        {!allowCustom || tab === "suggested" ? (
          <>
            <p className="mt-3 text-center text-sm text-muted">Harder words are worth more points.</p>
            <div className="mt-3 grid gap-2">
              {choices.map((choice, index) => (
                <button
                  key={choice.word} type="button" onClick={() => onPick(index)}
                  className={`btn w-full justify-between border-2 px-4 py-3.5 text-base ${TIER_STYLE[choice.difficulty]}`}
                >
                  <span className="font-bold normal-case">{choice.word}</span>
                  <span className="text-xs font-semibold text-muted">
                    {choice.difficulty} · {BASE_POINTS[choice.difficulty]}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-3">
            <label className="label" htmlFor="own-word">Your word</label>
            <input
              id="own-word" className="input mt-1" value={text} maxLength={CUSTOM_WORD_MAX}
              placeholder="e.g. space rocket" autoComplete="off"
              onChange={(event) => { setText(event.target.value); setServerError(null); }}
              onKeyDown={(event) => { if (event.key === "Enter" && check?.ok) void submit(); }}
            />
            <p className={`mt-1 text-sm ${serverError || (check && !check.ok) ? "font-semibold text-danger" : "text-muted"}`}>
              {serverError ?? check?.message ?? "Letters, spaces and hyphens. Keep it guessable."}
            </p>

            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={save}
                onChange={(event) => setSave(event.target.checked)} />
              Save to my words
            </label>

            <button type="button" className="btn-primary mt-3 w-full" disabled={busy || !check?.ok} onClick={submit}>
              {busy ? "Sending…" : "Use this word"}
            </button>

            <button
              type="button" className="mt-3 text-sm font-semibold text-brand"
              onClick={async () => setSaved((await onLoadSaved())?.words ?? [])}
            >
              My saved words
            </button>
            {saved ? (
              saved.length ? (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {saved.map((word) => (
                    <li key={word}>
                      <button type="button" className="chip normal-case" onClick={() => setText(word)}>{word}</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-muted">Nothing saved yet.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );

  async function submit() {
    setBusy(true);
    setServerError(null);
    const result = await onCustom(text, save);
    if (!result) setServerError("That word was not accepted — try another.");
    setBusy(false);
  }
}
