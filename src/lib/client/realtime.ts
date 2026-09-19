"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeEvent } from "@/lib/game/types";

let client: SupabaseClient | null = null;

export function realtimeEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getClient(): SupabaseClient | null {
  if (!realtimeEnabled()) return null;
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 30 } } },
  );
  return client;
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
  const supabase = getClient();
  if (!supabase) {
    onStatus?.("disconnected");
    return { send: () => {}, close: () => {} };
  }

  const topic = `room-${code.toUpperCase()}`;
  const channel: RealtimeChannel = supabase.channel(topic, {
    config: { broadcast: { self: false, ack: false } },
  });

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

  return {
    send(event) {
      channel.send({ type: "broadcast", event: "game", payload: event });
    },
    close() {
      supabase.removeChannel(channel);
    },
  };
}
