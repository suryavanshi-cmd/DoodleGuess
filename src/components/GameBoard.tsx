"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "./Canvas";
import { Confetti } from "./Confetti";
import { Feed, type FeedTab } from "./Feed";
import { PlayerList } from "./PlayerList";
import { ReactionBar, ReactionOverlay } from "./Reactions";
import { Replay } from "./Replay";
import { Timer } from "./Timer";
import { WordPicker } from "./WordPicker";
import { ThemeToggle } from "./ThemeToggle";
import { ping } from "@/lib/client/sound";
import { setMuted, useMuted } from "@/lib/client/storage";
import { POWER_UP_COSTS } from "@/lib/game/scoring";
import type { useRoom } from "@/lib/client/useRoom";

type Room = ReturnType<typeof useRoom>;

export function GameBoard({ room, onLeave }: { room: Room; onLeave: () => void }) {
  const { state, me, isDrawer, feed, strokes, reactions, frozen, actions } = room;
  const [tab, setTab] = useState<FeedTab>("guesses");
  const [celebrations, setCelebrations] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const muted = useMuted();
  const lastCorrect = useRef<string | null>(null);

  // Celebrate my own correct guess (and only mine).
  useEffect(() => {
    const mine = [...feed].reverse().find((entry) => entry.kind === "correct" && entry.playerId === me?.id);
    if (mine && mine.id !== lastCorrect.current) {
      lastCorrect.current = mine.id;
      setCelebrations((count) => count + 1);
      ping("correct");
    }
  }, [feed, me?.id]);

  const round = state?.round ?? null;
  const iGuessedIt = Boolean(me?.guessedCorrect);
  const canGuess = Boolean(state?.status === "drawing" && !isDrawer && !iGuessedIt && !frozen);

  const wordDisplay = !round
    ? ""
    : round.status === "ended" && round.revealedWord
      ? round.revealedWord.toUpperCase()
      : isDrawer && state?.yourWord
        ? state.yourWord.toUpperCase()
        : round.maskedWord;

  const guessHint = frozen
    ? "🧊 Frozen for a moment — hang tight!"
    : iGuessedIt
      ? "You got it! Sit tight while the others guess."
      : isDrawer
        ? "You're drawing this turn."
        : hint;

  const canBuyHint = Boolean(
    state?.settings.powerUpsEnabled && state.status === "drawing" && !isDrawer && !iGuessedIt &&
    (me?.score ?? 0) >= POWER_UP_COSTS.hint,
  );
  const canFreeze = Boolean(
    state?.settings.powerUpsEnabled && state.status === "drawing" && !isDrawer && !iGuessedIt &&
    (me?.score ?? 0) >= POWER_UP_COSTS.freeze,
  );

  if (!state) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4">
      <header className="card mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
        <div className="flex items-center gap-2">
          <span className="chip">Round {state.roundNumber}/{state.totalRounds}</span>
          {round?.difficulty ? <span className="chip capitalize">{round.difficulty}</span> : null}
          {round?.doublePoints ? <span className="chip bg-warning/20 text-warning">⚡ Double points</span> : null}
        </div>

        <div className="order-last w-full text-center sm:order-none sm:w-auto sm:flex-1">
          <p className="font-mono text-2xl font-black tracking-[0.25em] sm:text-3xl" aria-label="The word">
            {wordDisplay || (state.status === "picking" ? "· · ·" : "")}
          </p>
          <p className="text-xs text-muted">
            {state.status === "picking"
              ? `${state.players.find((p) => p.id === round?.drawerId)?.name ?? "Someone"} is choosing a word…`
              : round?.status === "ended"
                ? "That was the word"
                : isDrawer ? "Draw this!" : round?.shape.length ? `${round.shape.join(" + ")} letters` : ""}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Timer endsAt={state.status === "drawing" ? round?.endsAt ?? null : null} serverTime={state.serverTime} totalSeconds={state.settings.turnSeconds} />
          <button
            type="button" className="btn-ghost px-3" aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            onClick={() => setMuted(!muted)}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <ThemeToggle />
          <button type="button" className="btn-ghost px-3" onClick={onLeave}>Leave</button>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="relative">
            <Canvas
              strokes={strokes}
              canDraw={isDrawer && state.status === "drawing"}
              onStroke={room.pushStroke}
              onCanvas={room.pushCanvas}
            />
            <ReactionOverlay reactions={reactions} />
            <Confetti trigger={celebrations} />

            {isDrawer && state.status === "picking" && state.yourChoices && round ? (
              <WordPicker choices={state.yourChoices} onPick={(index) => void actions.choose(round.id, index)} />
            ) : null}

            {state.status === "intermission" && state.lastTurn ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 p-3 backdrop-blur-sm">
                <div className="animate-pop-in card max-h-full w-full max-w-md overflow-y-auto p-4">
                  <p className="text-center text-sm text-muted">The word was</p>
                  <p className="text-center text-2xl font-black">{state.lastTurn.word}</p>
                  <div className="mt-3"><Replay key={round?.id ?? "replay"} strokes={strokes} /></div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {state.lastTurn.scores.length === 0 ? (
                      <li className="text-center text-muted">Nobody got that one!</li>
                    ) : state.lastTurn.scores.map((score) => (
                      <li key={score.playerId} className="flex justify-between">
                        <span>{state.players.find((p) => p.id === score.playerId)?.name ?? "Player"}</span>
                        <span className="font-semibold text-success">+{score.gained}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-center text-xs text-muted">Next turn starts automatically.</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ReactionBar onReact={(emoji) => void actions.react(emoji)} />
            {state.settings.powerUpsEnabled && !isDrawer ? (
              <button
                type="button"
                className="btn-ghost ml-auto"
                disabled={!canBuyHint}
                onClick={async () => {
                  const result = await actions.powerUp("hint");
                  if (result?.hint) {
                    setHint(`🔍 ${result.hint}`);
                    setTimeout(() => setHint(null), 12_000);
                  }
                }}
                title={`Reveal one letter for ${POWER_UP_COSTS.hint} points`}
              >
                🔍 Hint ({POWER_UP_COSTS.hint})
              </button>
            ) : null}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3">
          <div className="card order-2 p-2.5 lg:order-1">
            <PlayerList
              players={state.players}
              meId={me?.id ?? null}
              drawerId={round?.drawerId ?? null}
              canFreeze={canFreeze}
              onFreeze={(playerId) => void actions.powerUp("freeze", playerId)}
            />
            {state.settings.powerUpsEnabled && !isDrawer ? (
              <p className="mt-2 px-1 text-xs text-muted">🧊 Freeze an opponent for {POWER_UP_COSTS.freeze} points.</p>
            ) : null}
          </div>

          <Feed
            className="order-1 lg:order-2"
            entries={feed}
            tab={tab}
            onTab={setTab}
            disabled={tab === "guesses" ? !canGuess : false}
            hint={tab === "guesses" ? guessHint : null}
            placeholder={tab === "chat" ? "Say something nice…" : canGuess ? "Type your guess…" : "Guessing is paused"}
            onSend={async (text) => {
              if (tab === "chat") {
                await actions.chat(text);
                return;
              }
              const result = await actions.guess(text);
              if (result?.verdict === "close") {
                setHint("Almost — try again!");
                ping("close");
                setTimeout(() => setHint(null), 4_000);
              }
            }}
          />
        </aside>
      </div>
    </div>
  );
}
