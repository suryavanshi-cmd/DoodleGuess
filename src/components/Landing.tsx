"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarPicker } from "./AvatarPicker";
import { SettingsForm } from "./SettingsForm";
import { ThemeToggle } from "./ThemeToggle";
import { api, ApiError } from "@/lib/client/api";
import { realtimeEnabled } from "@/lib/client/realtime";
import { DEFAULT_AVATAR, saveProfile, saveSession, useStoredProfile } from "@/lib/client/storage";
import { DEFAULT_SETTINGS, type RoomSettings } from "@/lib/game/settings";
import type { Avatar } from "@/lib/game/types";

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

  useEffect(() => {
    void api.publicRooms().then(({ rooms: list }) => setRooms(list)).catch(() => undefined);
    // Ask the server which variables it can actually see, so a half-configured
    // deployment names the missing one instead of guessing.
    void fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((h: { missing?: string[] }) => setMissingVars(h.missing ?? []))
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
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Doodle<span className="text-brand">Guess</span>
          </h1>
          <p className="text-muted">Draw it. Guess it. Laugh about it.</p>
        </div>
        <ThemeToggle />
      </header>

      {!realtimeEnabled() || (missingVars && missingVars.length > 0) ? (
        <div className="mb-5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <strong>Local mode.</strong> Rooms live in this server&apos;s memory, so they vanish between
          requests and cannot be shared across devices.
          {missingVars && missingVars.length > 0 ? (
            <>
              <span className="mt-1 block">Missing on this deployment:</span>
              <ul className="mt-1 list-inside list-disc font-mono text-xs">
                {missingVars.map((name) => <li key={name}>{name}</li>)}
              </ul>
              <span className="mt-1 block">
                Add them in your host&apos;s environment settings, then redeploy <em>without</em> the build cache
                — <code>NEXT_PUBLIC_*</code> values are baked in at build time.
              </span>
            </>
          ) : (
            <span className="mt-1 block">
              The server has its keys but this page was built without the <code>NEXT_PUBLIC_*</code> ones.
              Redeploy without the build cache.
            </span>
          )}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section className="card p-5">
          <h2 className="text-xl font-bold">Start a room</h2>
          <p className="mt-1 text-sm text-muted">
            You get a 6-character code to share. Up to 16 players per room.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="name">Your nickname</label>
              <input
                id="name" className="input mt-1.5" value={name} maxLength={16}
                placeholder="e.g. Pixel" onChange={(e) => setDraftName(e.target.value)}
              />
            </div>
            <AvatarPicker value={avatar} onChange={setDraftAvatar} />

            <button type="button" className="text-sm font-semibold text-brand" onClick={() => setShowSettings((s) => !s)}>
              {showSettings ? "Hide game settings" : "Game settings"} ({settings.rounds} rounds · {settings.turnSeconds}s · {settings.pack})
            </button>
            {showSettings ? <SettingsForm settings={settings} onChange={setSettings} /> : null}

            <button type="button" className="btn-primary w-full text-lg" disabled={busy || name.trim().length < 2} onClick={create}>
              {busy ? "Creating…" : "Create room"}
            </button>
          </div>
        </section>

        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="text-xl font-bold">Join a room</h2>
            <div className="mt-3 flex gap-2">
              <input
                className="input font-mono text-lg tracking-[0.3em] uppercase"
                value={joinCode} maxLength={6} placeholder="CODE"
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") join(joinCode); }}
              />
              <button type="button" className="btn-primary" onClick={() => join(joinCode)}>Join</button>
            </div>
            {error ? <p className="mt-2 text-sm font-medium text-danger">{error}</p> : null}

            {rooms.length ? (
              <div className="mt-4">
                <span className="label">Public rooms</span>
                <ul className="mt-1.5 space-y-1.5">
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
              </div>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-bold">What&apos;s different here</h2>
            <ul className="mt-2 space-y-2 text-sm text-muted">
              <li>✏️ <strong className="text-fg">Real drawing tools</strong> — shapes, fill bucket, undo/redo.</li>
              <li>🎯 <strong className="text-fg">Typos still count</strong> — &ldquo;elefant&rdquo; gets the point, &ldquo;almost!&rdquo; is private.</li>
              <li>🔐 <strong className="text-fg">No peeking</strong> — the word never leaves the server for guessers.</li>
              <li>🎬 <strong className="text-fg">Replay + recap</strong> — watch the drawing again, see who was fastest.</li>
            </ul>
            <p className="mt-3 text-xs text-muted">
              We keep your nickname, avatar and score for the session only. No ads, no tracking, no accounts.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
