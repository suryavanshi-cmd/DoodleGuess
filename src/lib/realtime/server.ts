import "server-only";
import type { RealtimeEvent } from "@/lib/game/types";

export function roomTopic(code: string): string {
  return `room-${code.toUpperCase()}`;
}

/**
 * Fan an event out to everyone in the room over Supabase Realtime's HTTP
 * broadcast endpoint — stateless, so a serverless route needn't hold a socket.
 * Without Supabase the clients fall back to polling, so this is a no-op.
 */
export async function publish(code: string, event: RealtimeEvent): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        messages: [{ topic: roomTopic(code), event: "game", payload: event }],
      }),
    });
  } catch {
    // Realtime is an accelerator, never the source of truth: clients poll too.
  }
}
