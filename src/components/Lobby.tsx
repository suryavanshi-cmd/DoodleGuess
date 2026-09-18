"use client";

import { useState } from "react";
import { AvatarBadge } from "./AvatarPicker";
import { SettingsForm } from "./SettingsForm";
import { ThemeToggle } from "./ThemeToggle";
import type { useRoom } from "@/lib/client/useRoom";

type Room = ReturnType<typeof useRoom>;

export function Lobby({ room, onLeave }: { room: Room; onLeave: () => void }) {
  const { state, me, actions } = room;
  const [copied, setCopied] = useState(false);
  const [packName, setPackName] = useState("Our words");
  const [packWords, setPackWords] = useState("");
  const [packStatus, setPackStatus] = useState<string | null>(null);

  if (!state) return null;
  const isHost = Boolean(me?.isHost);
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/room/${state.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setPackStatus("Copy failed — select the code above instead.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Doodle<span className="text-brand">Guess</span></h1>
        <div className="flex gap-2">
          <ThemeToggle />
          <button type="button" className="btn-ghost" onClick={onLeave}>Leave</button>
        </div>
      </header>

      <section className="card p-5 text-center">
        <p className="label">Room code</p>
        <p className="font-mono text-5xl font-black tracking-[0.3em]">{state.code}</p>
        <button type="button" className="btn-ghost mt-3" onClick={copy}>
          {copied ? "✅ Link copied" : "🔗 Copy invite link"}
        </button>
        <p className="mt-2 text-sm text-muted">Share the code or link — anyone with it can join.</p>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="text-lg font-bold">Players ({state.players.length})</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {state.players.map((player) => (
            <li key={player.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-2.5">
              <AvatarBadge avatar={player.avatar} size={36} />
              <span className="font-semibold">{player.name}{player.id === me?.id ? " (you)" : ""}</span>
              {player.isHost ? <span className="chip ml-auto">host</span> : null}
            </li>
          ))}
        </ul>
        {state.players.length < 2 ? (
          <p className="mt-3 text-sm text-muted">Waiting for at least one more player…</p>
        ) : null}
      </section>

      <section className="card mt-4 p-4">
        <h2 className="text-lg font-bold">Game settings</h2>
        {!isHost ? <p className="mt-1 text-sm text-muted">Only the host can change these.</p> : null}
        <div className="mt-3">
          <SettingsForm
            settings={state.settings}
            disabled={!isHost}
            onChange={(next) => void actions.updateSettings(next)}
          />
        </div>

        {isHost ? (
          <details className="mt-4 rounded-xl border border-line bg-surface-2 p-3">
            <summary className="cursor-pointer font-semibold">Custom word pack</summary>
            <p className="mt-2 text-sm text-muted">Paste comma-separated words. They are used instead of the built-in packs.</p>
            <input className="input mt-2" value={packName} onChange={(e) => setPackName(e.target.value)} placeholder="Pack name" />
            <textarea
              className="input mt-2 min-h-24" value={packWords}
              onChange={(e) => setPackWords(e.target.value)}
              placeholder="dragon, pancake, roller coaster, thunderstorm"
            />
            <button
              type="button" className="btn-primary mt-2"
              onClick={async () => {
                const result = await actions.uploadPack(packName, packWords);
                setPackStatus(result ? `Saved ${result.count} words — this room now uses them.` : null);
              }}
            >
              Save word pack
            </button>
            {packStatus ? <p className="mt-2 text-sm font-medium text-success">{packStatus}</p> : null}
          </details>
        ) : null}
      </section>

      <div className="mt-5">
        {isHost ? (
          <button
            type="button" className="btn-primary w-full text-lg"
            disabled={state.players.length < 2}
            onClick={() => void actions.start()}
          >
            {state.players.length < 2 ? "Waiting for players…" : "Start game"}
          </button>
        ) : (
          <p className="text-center text-muted">Waiting for the host to start…</p>
        )}
      </div>
    </main>
  );
}
