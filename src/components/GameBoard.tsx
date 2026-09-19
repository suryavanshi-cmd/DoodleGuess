"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "./Canvas";
import { ClueBoard } from "./ClueBoard";
import { Confetti } from "./Confetti";
import { Feed, FeedList, FeedTabs, GuessInput, type FeedTab } from "./Feed";
import { PlayerList, PlayerStrip } from "./PlayerList";
import { PresenceBar } from "./PresenceBar";
import { ReactionBar, ReactionOverlay } from "./Reactions";
import { Replay } from "./Replay";
import { Timer } from "./Timer";
import { ToastFeed } from "./ToastFeed";
import { WordPicker } from "./WordPicker";
import { ThemeToggle } from "./ThemeToggle";
import { ping } from "@/lib/client/sound";
import { setMuted, useMuted } from "@/lib/client/storage";
import { POWER_UP_COSTS } from "@/lib/game/scoring";
import type { useRoom } from "@/lib/client/useRoom";
import type { PublicState } from "@/lib/game/types";

type Room = ReturnType<typeof useRoom>;

export function GameBoard({ room, onLeave }: { room: Room; onLeave: () => void }) {
  const { state, me, isDrawer, feed, strokes, reactions, frozen, actions } = room;
  const [tab, setTab] = useState<FeedTab>("guesses");
  const [celebrations, setCelebrations] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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
  const approval = state?.hostApproval ?? null;
  const textMode = state?.settings.gameMode === "text_clue";
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
        ? (textMode ? "You're giving the clue this turn." : "You're drawing this turn.")
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

  const send = async (text: string) => {
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
  };

  const placeholder = tab === "chat"
    ? "Say something nice…"
    : canGuess ? "Type your guess…" : "Guessing is paused";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-7xl flex-col gap-1.5 overflow-hidden px-1.5 py-1.5 sm:gap-2 sm:px-3 sm:py-2 lg:gap-3 lg:px-4 lg:py-3">
      <header className="card flex items-center gap-1.5 px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
        <span className="chip shrink-0 px-2 text-xs sm:text-sm">
          {state.roundNumber}/{state.totalRounds}
        </span>
        {round?.doublePoints ? (
          <span className="chip hidden shrink-0 bg-warning/20 text-warning sm:inline-flex">⚡ Double</span>
        ) : null}

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-display text-2xl tracking-[0.18em] sm:text-3xl" aria-label="The word">
            {wordDisplay || (state.status === "picking" ? "· · ·" : "")}
          </p>
          <p className="truncate text-[11px] text-muted sm:text-xs">
            {state.status === "picking"
              ? `${state.players.find((p) => p.id === round?.drawerId)?.name ?? "Someone"} is choosing…`
              : round?.status === "ended"
                ? "That was the word"
                : isDrawer
                  ? (textMode ? "Write a clue for this!" : "Draw this!")
                  : round?.shape.length ? `${round.shape.join(" + ")} letters` : ""}
          </p>
        </div>

        <Timer
          endsAt={state.status === "drawing" ? round?.endsAt ?? null : null}
          serverTime={state.serverTime}
          totalSeconds={state.settings.turnSeconds}
        />

        <button
          type="button"
          className="btn-ghost shrink-0 px-2.5 lg:hidden"
          onClick={() => setSheetOpen(true)}
          aria-label="Open chat and guess history"
        >
          💬
        </button>
        <span className="hidden shrink-0 gap-2 sm:flex">
          <button
            type="button" className="btn-ghost px-2.5" aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            onClick={() => setMuted(!muted)}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <ThemeToggle />
          <button type="button" className="btn-ghost px-3" onClick={onLeave}>Leave</button>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-3">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 sm:gap-2">
          <div className="relative flex shrink-0 flex-col justify-center lg:min-h-0 lg:flex-1">
            {textMode && round ? (
              <ClueBoard
                round={round}
                isGiver={isDrawer}
                secretWord={state.yourWord ?? null}
                onSubmit={(value) => actions.submitClue(round.id, value)}
                onSuggest={() => actions.clueSuggestions(round.id)}
              />
            ) : (
              <Canvas
                strokes={strokes}
                canDraw={isDrawer && state.status === "drawing"}
                onStroke={room.pushStroke}
                onCanvas={room.pushCanvas}
              />
            )}

            <ReactionOverlay reactions={reactions} />
            <Confetti trigger={celebrations} />
            {/* Live ticker down the right of the stage. Click-through, so it
                never intercepts a stroke; the full record is in the history. */}
            <ToastFeed entries={feed} />

            {isDrawer && state.status === "picking" && state.yourChoices && round ? (
              <WordPicker
                choices={state.yourChoices}
                onPick={(index) => void actions.choose(round.id, index)}
                allowCustom={state.settings.allowCustomWords}
                strictFilter={state.settings.strictFilter}
                customWord={state.yourCustomWord ?? null}
                onCustom={(word, save) => actions.submitCustomWord(round.id, word, save)}
                onLoadSaved={() => actions.myWords()}
              />
            ) : null}

            {approval ? (
              <HostApproval
                approval={approval}
                serverTime={state.serverTime}
                onResolve={(approve) => void actions.resolveCustomWord(approval.roundId, approve)}
              />
            ) : null}

            {state.status === "intermission" && state.lastTurn ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/60 p-3 backdrop-blur-sm">
                <div className="animate-pop-in card max-h-full w-full max-w-md overflow-y-auto p-4">
                  <p className="text-center text-sm text-muted">The word was</p>
                  <p className="text-center text-2xl font-black">{state.lastTurn.word}</p>
                  {textMode ? (
                    <p className="mt-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-center text-sm">
                      <span className="block text-xs text-muted">
                        {state.lastTurn.clueSource === "clue_bank" ? "Clue from the bank" : "Their clue"}
                      </span>
                      “{state.lastTurn.clueText}”
                    </p>
                  ) : (
                    <div className="mt-3"><Replay key={round?.id ?? "replay"} strokes={strokes} /></div>
                  )}
                  <ul className="mt-3 space-y-1 text-sm">
                    {state.lastTurn.scores.length === 0 ? (
                      <li className="text-center text-muted">Nobody got that one!</li>
                    ) : state.lastTurn.scores.map((score) => {
                      const match = state.lastTurn?.matches?.find((m) => m.playerId === score.playerId);
                      return (
                        <li key={score.playerId} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {state.players.find((p) => p.id === score.playerId)?.name ?? "Player"}
                            {match?.matchType === "synonym" ? (
                              <span className="ml-1.5 text-xs font-semibold text-warning">synonym</span>
                            ) : match?.matchType === "fuzzy" ? (
                              <span className="ml-1.5 text-xs font-semibold text-muted">near spelling</span>
                            ) : null}
                          </span>
                          <span className="font-semibold text-success">+{score.gained}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-center text-xs text-muted">Next turn starts automatically.</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="card min-h-0 flex-1 overflow-hidden lg:hidden">
            <FeedList entries={feed} tab={tab} />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ReactionBar onReact={(emoji) => void actions.react(emoji)} />
            {state.settings.powerUpsEnabled && !isDrawer ? (
              <button
                type="button"
                className="btn-ghost ml-auto shrink-0 px-3"
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
                🔍 <span className="hidden sm:inline">Hint</span> ({POWER_UP_COSTS.hint})
              </button>
            ) : null}
          </div>
        </div>

        <aside className="hidden min-h-0 flex-col gap-3 lg:flex">
          <div className="card px-2.5 py-2">
            <PresenceBar players={state.players} meId={me?.id ?? null} />
          </div>

          <div className="card p-2.5">
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
            entries={feed}
            tab={tab}
            onTab={setTab}
            disabled={tab === "guesses" ? !canGuess : false}
            hint={tab === "guesses" ? guessHint : null}
            placeholder={placeholder}
            onSend={send}
          />
        </aside>
      </div>

      {/* Phone: roster rail and the guess box stay put at the bottom. */}
      <div className="flex shrink-0 flex-col gap-1.5 lg:hidden">
        <PlayerStrip players={state.players} meId={me?.id ?? null} drawerId={round?.drawerId ?? null} />
        <GuessInput
          tab={tab}
          onSend={send}
          disabled={tab === "guesses" ? !canGuess : false}
          placeholder={placeholder}
          hint={tab === "guesses" ? guessHint : null}
        />
      </div>

      {sheetOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSheetOpen(false)}>
          <div
            className="animate-sheet-down card absolute inset-x-2 top-2 flex max-h-[70dvh] flex-col overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-line px-2.5 py-2">
              <PresenceBar players={state.players} meId={me?.id ?? null} />
            </div>
            <div className="flex items-center gap-2 pr-2">
              <div className="min-w-0 flex-1"><FeedTabs tab={tab} onTab={setTab} /></div>
              <button type="button" className="btn-ghost px-3" onClick={() => setSheetOpen(false)} aria-label="Close">✕</button>
            </div>
            <FeedList entries={feed} tab={tab} />
            <div className="flex items-center gap-2 border-t border-line p-2.5">
              <button
                type="button" className="btn-ghost flex-1 px-2" aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => setMuted(!muted)}
              >
                {muted ? "🔇" : "🔊"}
              </button>
              <ThemeToggle className="flex-1" />
              <button type="button" className="btn-ghost flex-1 px-2" onClick={onLeave}>Leave</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Host-only prompt: approve or reject the drawer's own word before the turn starts. */
function HostApproval({ approval, serverTime, onResolve }: {
  approval: NonNullable<PublicState["hostApproval"]>;
  serverTime: string;
  onResolve: (approve: boolean) => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  // Same clock trick as the round timer: trust the server, not the device.
  const skew = Date.parse(serverTime) - now;
  const seconds = Math.max(0, Math.ceil((Date.parse(approval.endsAt) - (now + skew)) / 1000));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm lg:absolute lg:z-40 lg:rounded-2xl">
      <div className="animate-pop-in card max-h-full w-full max-w-sm overflow-y-auto p-4 text-center sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Host check · {seconds}s</p>
        <h3 className="mt-1 text-lg">
          <span className="text-brand">{approval.drawerName}</span> wants to use
        </h3>
        <p className="mt-2 break-words rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xl font-black normal-case">
          {approval.word}
        </p>
        <p className="mt-2 text-sm text-muted">Nobody else can see this word.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={() => onResolve(false)}>Reject</button>
          <button type="button" className="btn-primary flex-1" onClick={() => onResolve(true)}>Approve</button>
        </div>
        <p className="mt-2 text-xs text-muted">No answer in time and we pick a word for them.</p>
      </div>
    </div>
  );
}
