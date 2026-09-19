"use client";

import type { Session } from "./storage";

export class ApiError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
  }
}

/**
 * Where the authoritative server lives. Defaults to this app's own route
 * handlers; set NEXT_PUBLIC_GAME_API to the Supabase Edge Function URL
 * (https://<ref>.supabase.co/functions/v1/game) to use that instead, which
 * keeps the service key inside Supabase and leaves this app secret-free.
 */
const API_BASE = (process.env.NEXT_PUBLIC_GAME_API ?? "/api").replace(/\/$/, "");
const IS_REMOTE = /^https?:/i.test(API_BASE);

async function request<T>(path: string, init: RequestInit & { session?: Session | null } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (init.session) {
    headers.set("x-player-id", init.session.playerId);
    headers.set("x-player-token", init.session.token);
  }
  // Supabase Edge Functions require a project key; the publishable one is
  // public by design and grants nothing on its own.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (IS_REMOTE && anonKey) {
    headers.set("apikey", anonKey);
    headers.set("authorization", `Bearer ${anonKey}`);
  }
  const response = await fetch(`${API_BASE}${path.replace(/^\/api/, "")}`, { ...init, headers, cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: string; code: string }
    | null;
  if (!payload) throw new ApiError("The server sent an unreadable response.", "bad_response", response.status);
  if (!payload.ok) throw new ApiError(payload.error, payload.code, response.status);
  return payload.data;
}

export const api = {
  createRoom: (input: { name: string; avatar: unknown; settings: unknown }) =>
    request<{ code: string; playerId: string; token: string }>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  publicRooms: () => request<{ rooms: { code: string; players: number; status: string }[] }>("/api/rooms"),

  join: (code: string, input: { name: string; avatar: unknown; token?: string | null }) =>
    request<{ playerId: string; token: string; rejoined: boolean }>(`/api/rooms/${code}/join`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  state: (code: string, session: Session | null) =>
    request<import("@/lib/game/types").PublicState>(`/api/rooms/${code}/state`, { session }),

  start: (code: string, session: Session) =>
    request(`/api/rooms/${code}/start`, { method: "POST", session }),

  settings: (code: string, session: Session, settings: unknown) =>
    request(`/api/rooms/${code}/settings`, { method: "POST", session, body: JSON.stringify({ settings }) }),

  choose: (code: string, session: Session, roundId: string, index: number) =>
    request<import("@/lib/game/types").PublicState>(`/api/rooms/${code}/choose`, {
      method: "POST", session, body: JSON.stringify({ roundId, index }),
    }),

  clue: (code: string, session: Session, roundId: string, text: string) =>
    request<import("@/lib/game/types").PublicState>(`/api/rooms/${code}/clue`, {
      method: "POST", session, body: JSON.stringify({ roundId, text }),
    }),

  clueSuggestions: (code: string, session: Session, roundId: string) =>
    request<{ clues: string[] }>(`/api/rooms/${code}/clue-suggestion`, {
      method: "POST", session, body: JSON.stringify({ roundId }),
    }),

  guess: (code: string, session: Session, text: string) =>
    request<{ verdict: "correct" | "close" | "wrong" | "duplicate" }>(`/api/rooms/${code}/guess`, {
      method: "POST", session, body: JSON.stringify({ text }),
    }),

  chat: (code: string, session: Session, text: string) =>
    request(`/api/rooms/${code}/chat`, { method: "POST", session, body: JSON.stringify({ text }) }),

  powerUp: (code: string, session: Session, kind: "hint" | "freeze", targetId?: string) =>
    request<{ hint?: string }>(`/api/rooms/${code}/powerup`, {
      method: "POST", session, body: JSON.stringify({ kind, targetId }),
    }),

  reaction: (code: string, session: Session, emoji: string) =>
    request(`/api/rooms/${code}/reaction`, { method: "POST", session, body: JSON.stringify({ emoji }) }),

  saveStrokes: (code: string, session: Session, strokes: unknown[]) =>
    request(`/api/rooms/${code}/strokes`, { method: "POST", session, body: JSON.stringify({ strokes }) }),

  strokes: (roundId: string) =>
    request<{ strokes: import("@/lib/game/types").Stroke[] }>(`/api/rounds/${roundId}/strokes`),

  wordPack: (code: string, session: Session, name: string, words: string) =>
    request<{ id: string; count: number }>(`/api/rooms/${code}/word-pack`, {
      method: "POST", session, body: JSON.stringify({ name, words }),
    }),

  leave: (code: string, session: Session) =>
    request(`/api/rooms/${code}/leave`, { method: "POST", session }),
};
