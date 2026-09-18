"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Avatar } from "@/lib/game/types";

const CHANGE_EVENT = "doodleguess:storage";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Private browsing: nothing persists, which the UI tolerates.
  }
}

/**
 * localStorage as an external store. Using useSyncExternalStore (rather than an
 * effect that calls setState) keeps hydration correct: the server snapshot is
 * always null, and the real value arrives on the client's first commit.
 */
export function useStoredValue(key: string): string | null {
  const getSnapshot = useCallback(() => readLocal(key), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export const PROFILE_KEY = "doodleguess:profile";
export const MUTED_KEY = "doodleguess:muted";
export const sessionKey = (code: string) => `doodleguess:session:${code.toUpperCase()}`;

export interface Profile {
  name: string;
  avatar: Avatar;
}

export const DEFAULT_AVATAR: Avatar = { emoji: "🦊", color: "#f97316" };

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function useStoredProfile(): Profile | null {
  const raw = useStoredValue(PROFILE_KEY);
  return useMemo(() => parse<Profile>(raw), [raw]);
}

export function saveProfile(profile: Profile) {
  writeLocal(PROFILE_KEY, JSON.stringify(profile));
}

export interface Session {
  playerId: string;
  token: string;
}

export function useStoredSession(code: string): Session | null {
  const raw = useStoredValue(sessionKey(code));
  return useMemo(() => parse<Session>(raw), [raw]);
}

export function readSession(code: string): Session | null {
  return parse<Session>(readLocal(sessionKey(code)));
}

export function saveSession(code: string, session: Session) {
  writeLocal(sessionKey(code), JSON.stringify(session));
}

export function clearSession(code: string) {
  writeLocal(sessionKey(code), null);
}

export function useMuted(): boolean {
  return useStoredValue(MUTED_KEY) === "1";
}

export function setMuted(muted: boolean) {
  writeLocal(MUTED_KEY, muted ? "1" : "0");
}
