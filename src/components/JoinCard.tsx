"use client";

import { useState } from "react";
import { AvatarPicker } from "./AvatarPicker";
import { ThemeToggle } from "./ThemeToggle";
import { DEFAULT_AVATAR, saveProfile, useStoredProfile } from "@/lib/client/storage";
import type { Avatar } from "@/lib/game/types";

export function JoinCard({ code, onJoin }: { code: string; onJoin: (name: string, avatar: Avatar) => Promise<void> }) {
  const storedProfile = useStoredProfile();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftAvatar, setDraftAvatar] = useState<Avatar | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = draftName ?? storedProfile?.name ?? "";
  const avatar = draftAvatar ?? storedProfile?.avatar ?? DEFAULT_AVATAR;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      saveProfile({ name, avatar });
      await onJoin(name, avatar);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this room.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black">Doodle<span className="text-brand">Guess</span></h1>
        <ThemeToggle />
      </div>
      <div className="card p-5">
        <p className="label">Joining room</p>
        <p className="font-mono text-3xl font-black tracking-[0.3em]">{code}</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="join-name">Your nickname</label>
            <input
              id="join-name" className="input mt-1.5" value={name} maxLength={16}
              placeholder="e.g. Pixel" onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && name.trim().length >= 2) void submit(); }}
            />
          </div>
          <AvatarPicker value={avatar} onChange={setDraftAvatar} />
          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
          <button type="button" className="btn-primary w-full text-lg" disabled={busy || name.trim().length < 2} onClick={submit}>
            {busy ? "Joining…" : "Join room"}
          </button>
        </div>
      </div>
    </main>
  );
}
