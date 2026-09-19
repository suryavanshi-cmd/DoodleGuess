"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarPicker } from "./AvatarPicker";
import { SettingsForm } from "./SettingsForm";
import { ThemeToggle } from "./ThemeToggle";
import { api, ApiError } from "@/lib/client/api";
import { DEFAULT_AVATAR, saveProfile, saveSession, useStoredProfile } from "@/lib/client/storage";
import { DEFAULT_SETTINGS, type RoomSettings } from "@/lib/game/settings";
import type { Avatar } from "@/lib/game/types";

/** /api/health reports what it could not find; these are the names to fix. */
const MISSING_LABELS: Record<string, string> = {
  url: "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)",
  anonKey: "SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
  serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
};

const MODE_CARDS: { id: "draw" | "text_clue"; label: string; icon: string; hint: string }[] = [
  { id: "draw", label: "Draw it", icon: "🎨", hint: "Sketch it on the canvas" },
  { id: "text_clue", label: "Clue it", icon: "💬", hint: "One cryptic sentence" },
];

export function Landing() {
  const router = useRouter();
  const storedProfile = useStoredProfile();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftAvatar, setDraftAvatar] = useState<Avatar | null>(null);
  const name = draftName ?? storedProfile?.name ?? "";
  const avatar = draftAvatar ?? storedProfile?.avatar ?? DEFAULT_AVATAR;
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<{ code: string; players: number; status: string }[]>([]);
  const [missingVars, setMissingVars] = useState<string[] | null>(null);
  const [localMode, setLocalMode] = useState(false);

  useEffect(() => {
    void api.publicRooms().then(({ rooms: list }) => setRooms(list)).catch(() => undefined);
    // Ask the server which variables it can actually see, so a half-configured
    // deployment names the missing one instead of guessing.
    void fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((h: { missing?: string[]; mode?: string }) => {
        setMissingVars(h.missing ?? []);
        setLocalMode(h.mode !== "supabase");
      })
      .catch(() => undefined);
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.createRoom({ name, avatar, settings });
      saveProfile({ name, avatar });
      saveSession(result.code, { playerId: result.playerId, token: result.token });
      router.push(`/room/${result.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the room. Try again.");
      setBusy(false);
    }
  };

  const join = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      setError("Room codes are 6 characters, like QK4T7M.");
      return;
    }
    saveProfile({ name, avatar });
    router.push(`/room/${clean}`);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-start px-3 py-4 sm:justify-center sm:px-4 sm:py-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          {/* The wordmark is the way back to the front page. */}
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              <span className="text-gradient">Doodle</span>Guess
            </h1>
          </Link>
          <p className="mt-0.5 text-sm text-muted sm:text-base">Draw it, or clue it. Then watch everyone flail.</p>
        </div>
        <ThemeToggle />
      </header>

      {localMode ? (
        <div className="mb-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning sm:mb-4 sm:px-4 sm:py-3 sm:text-sm">
          <strong>Local mode.</strong> Rooms live in this server&apos;s memory, so they vanish between
          requests and cannot be shared across devices.
          {missingVars && missingVars.length > 0 ? (
            <>
              <span className="mt-1 block">This deployment has no:</span>
              <ul className="mt-0.5 list-inside list-disc font-mono text-[11px] sm:text-xs">
                {missingVars.map((name) => <li key={name}>{MISSING_LABELS[name] ?? name}</li>)}
              </ul>
              <span className="mt-1 hidden sm:block">
                Add them in your host&apos;s environment settings — they are read per request, so no
                rebuild is needed. <code>/api/health</code> lists every Supabase variable the server
                can see.
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="card min-w-0 p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-2">
            {MODE_CARDS.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSettings({ ...settings, gameMode: mode.id })}
                aria-pressed={settings.gameMode === mode.id}
                className={`flex items-center gap-2 rounded-2xl border-2 p-2.5 text-left transition sm:gap-3 sm:p-3
                  ${settings.gameMode === mode.id
                    ? "border-brand bg-brand/10 shadow-sm"
                    : "border-line bg-surface-2 hover:border-brand/40"}`}
              >
                <span className="text-2xl sm:text-3xl" aria-hidden>{mode.icon}</span>
                <span className="min-w-0">
                  <span className="block font-bold">{mode.label}</span>
                  <span className="hidden text-xs text-muted sm:block">{mode.hint}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="label" htmlFor="name">Your nickname</label>
              <input
                id="name" className="input mt-1" value={name} maxLength={16}
                placeholder="e.g. Pixel" onChange={(e) => setDraftName(e.target.value)}
              />
            </div>
            <button
              type="button" className="btn-primary text-lg sm:px-8"
              disabled={busy || name.trim().length < 2} onClick={create}
            >
              {busy ? "Creating…" : "Create room"}
            </button>
          </div>

          <div className="mt-3">
            <AvatarPicker value={avatar} onChange={setDraftAvatar} />
          </div>

          <button
            type="button"
            className="mt-3 text-sm font-semibold text-brand"
            onClick={() => setShowSettings((current) => !current)}
          >
            {showSettings ? "Hide game settings" : "Game settings"} · {settings.rounds} rounds · {settings.turnSeconds}s · {settings.pack}
          </button>
          {showSettings ? (
            <div className="mt-3 border-t border-line pt-3">
              <SettingsForm settings={settings} onChange={setSettings} />
            </div>
          ) : null}
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="card min-w-0 p-3 sm:p-5">
            <h2 className="text-lg font-bold">Join a room</h2>
            <div className="mt-2 flex gap-2">
              <input
                className="input font-mono text-lg uppercase tracking-[0.3em]"
                value={joinCode} maxLength={6} placeholder="CODE"
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") join(joinCode); }}
              />
              <button type="button" className="btn-primary px-6" onClick={() => join(joinCode)}>Join</button>
            </div>
            {error ? <p className="mt-2 text-sm font-medium text-danger">{error}</p> : null}

            {rooms.length ? (
              <ul className="mt-3 space-y-1.5">
                {rooms.map((room) => (
                  <li key={room.code}>
                    <button
                      type="button" onClick={() => join(room.code)}
                      className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2 px-3 py-2 text-left"
                    >
                      <span className="font-mono font-bold tracking-widest">{room.code}</span>
                      <span className="text-sm text-muted">{room.players} playing · {room.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="card hidden min-w-0 p-4 sm:block sm:p-5">
            <h2 className="text-lg font-bold">Why it plays better</h2>
            <ul className="mt-2 grid gap-2 text-sm text-muted sm:grid-cols-2 lg:grid-cols-1">
              <li>🎯 <strong className="text-fg">Typos still count</strong> — “elefant” scores; “almost!” stays private.</li>
              <li>💬 <strong className="text-fg">Clue mode</strong> — no canvas, just one sly sentence.</li>
              <li>🔐 <strong className="text-fg">No peeking</strong> — the word never leaves the server.</li>
              <li>🎬 <strong className="text-fg">Replay & recap</strong> — MVP artist, fastest guesser.</li>
            </ul>
            <p className="mt-3 text-xs text-muted">
              Nickname, avatar and score for the session only. No ads, no tracking, no accounts.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
