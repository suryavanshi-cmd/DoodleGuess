"use client";

import { useState } from "react";
import { CLUE_MAX_LENGTH, validateClue } from "@/lib/game/clues";
import type { PublicRound } from "@/lib/game/types";

/**
 * Text mode's stage. The Clue-Giver composes here; everyone else reads the
 * clue, large and uncluttered, with nothing else competing for attention.
 */
export function ClueBoard({ round, isGiver, secretWord, onSubmit, onSuggest }: {
  round: PublicRound;
  isGiver: boolean;
  secretWord: string | null;
  onSubmit: (text: string) => Promise<unknown>;
  onSuggest: () => Promise<{ clues: string[] } | null>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);

  const writing = round.status === "clue";
  // The same validator the server runs, so feedback is instant and identical.
  const check = secretWord && text.trim() ? validateClue(text, secretWord) : null;
  const remaining = CLUE_MAX_LENGTH - text.length;

  if (writing && isGiver && secretWord) {
    return (
      <div className="card flex min-h-[26rem] flex-col justify-center p-5 sm:p-8">
        <p className="text-center text-sm font-semibold text-muted">Your word is</p>
        <p className="mt-1 text-center text-3xl font-black tracking-wide sm:text-4xl">
          {secretWord.toUpperCase()}
        </p>
        <p className="mt-3 text-center text-sm text-muted">
          Write one clue. No saying the word, no rhyming it, no spelling it out.
        </p>

        <textarea
          className="input mt-4 min-h-20 text-lg"
          value={text}
          maxLength={CLUE_MAX_LENGTH}
          placeholder="e.g. Purrs and naps in sunbeams"
          onChange={(event) => { setText(event.target.value); setServerError(null); }}
          aria-label="Your clue"
        />

        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <span className={check && !check.ok ? "font-semibold text-danger" : "text-muted"}>
            {serverError ?? (check ? check.message : "Keep it short and sly.")}
          </span>
          <span className={remaining < 10 ? "font-semibold text-warning" : "text-muted"}>{remaining}</span>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="btn-ghost sm:w-auto"
            onClick={async () => {
              const result = await onSuggest();
              setSuggestions(result?.clues.slice(0, 3) ?? []);
            }}
          >
            💡 Need inspiration?
          </button>
          <button
            type="button"
            className="btn-primary flex-1 text-lg"
            disabled={busy || !check?.ok}
            onClick={async () => {
              setBusy(true);
              setServerError(null);
              const result = await onSubmit(text);
              if (!result) setServerError("That clue was rejected — try another angle.");
              setBusy(false);
            }}
          >
            {busy ? "Sending…" : "Send clue"}
          </button>
        </div>

        {suggestions ? (
          <div className="mt-4">
            <p className="label">From the clue bank — tap to use</p>
            {suggestions.length === 0 ? (
              <p className="mt-1 text-sm text-muted">No clues on file for this word yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {suggestions.map((clue) => (
                  <li key={clue}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-left text-sm"
                      onClick={() => setText(clue.slice(0, CLUE_MAX_LENGTH))}
                    >
                      {clue}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  if (writing) {
    return (
      <div className="card flex min-h-[26rem] flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-5xl" aria-hidden>✍️</span>
        <p className="text-xl font-bold">The Clue-Giver is writing…</p>
        <p className="text-muted">Get ready — the clock starts the moment their clue lands.</p>
      </div>
    );
  }

  return (
    <div className="card flex min-h-[26rem] flex-col items-center justify-center gap-4 p-6 text-center sm:p-10">
      <p className="label">{round.status === "ended" ? "The clue was" : "The clue"}</p>
      <p className="text-balance text-2xl font-black leading-snug sm:text-4xl">
        {round.clueText ?? "…"}
      </p>
      {round.clueSource === "clue_bank" ? (
        <span className="chip">from the clue bank</span>
      ) : null}
      {isGiver && secretWord ? (
        <p className="text-sm text-muted">
          Your word: <strong className="text-fg">{secretWord.toUpperCase()}</strong>
        </p>
      ) : null}
    </div>
  );
}
