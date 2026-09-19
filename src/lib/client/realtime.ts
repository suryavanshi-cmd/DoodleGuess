"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeEvent } from "@/lib/game/types";

let client: SupabaseClient | null = null;
let pending: Promise<SupabaseClient | null> | null = null;

function build(url: string, key: string): SupabaseClient {
  client ??= createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 30 } },
  });
  return client;
}

/**
 * Build-time values win because they cost nothing; otherwise ask the server
 * once and cache the promise, so a room full of components makes one request.
 */
function getClient(): Promise<SupabaseClient | null> {
  if (client) return Promise.resolve(client);
  const bakedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bakedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (bakedUrl && bakedKey) return Promise.resolve(build(bakedUrl, bakedKey));

  pending ??= fetch("/api/config", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((config: { supabaseUrl?: string | null; supabaseAnonKey?: string | null } | null) => (
      config?.supabaseUrl && config.supabaseAnonKey
        ? build(config.supabaseUrl, config.supabaseAnonKey)
        : null
    ))
    .catch(() => null);
  return pending;
}

export type RoomChannelStatus = "connected" | "disconnected";

export interface RoomChannel {
  send(event: RealtimeEvent): void;
  close(): void;
}

/**
 * Live room channel. Strokes go peer-to-peer for latency; anything that
 * affects scores still comes from the server. Without Supabase this returns a
 * no-op channel and the hook falls back to polling.
 */
export function joinRoomChannel(
  code: string,
  onEvent: (event: RealtimeEvent) => void,
  onStatus?: (status: RoomChannelStatus) => void,
): RoomChannel {
  // The settings may still be in flight, so hand back a channel immediately and
  // attach once they land. Until then the caller polls, which is the same path
  // a WebSocket-blocking network takes.
  let live: { supabase: SupabaseClient; channel: RealtimeChannel } | null = null;
  let closed = false;
  onStatus?.("disconnected");

  void getClient().then((supabase) => {
    if (!supabase || closed) {
      if (!supabase) onStatus?.("disconnected");
      return;
    }

    const channel = supabase.channel(`room-${code.toUpperCase()}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    live = { supabase, channel };

    channel.on("broadcast", { event: "game" }, (message) => {
      const payload = message.payload as RealtimeEvent | undefined;
      if (payload?.type) onEvent(payload);
    });
    // Report real connection state, not merely whether Realtime is configured:
    // networks that block WebSockets must fall back to polling, or a guesser
    // would sit watching a blank canvas.
    channel.subscribe((status) => {
      onStatus?.(status === "SUBSCRIBED" ? "connected" : "disconnected");
    });
  });

  return {
    send(event) {
      live?.channel.send({ type: "broadcast", event: "game", payload: event });
    },
    close() {
      closed = true;
      if (live) live.supabase.removeChannel(live.channel);
      live = null;
    },
  };
}
