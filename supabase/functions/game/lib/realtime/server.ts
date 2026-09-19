// GENERATED from src/lib/realtime/server.ts by scripts/build-edge-function.mjs.
// Do not edit — change the original and run `npm run build:edge`.

import type { RealtimeEvent } from "../game/types.ts";

export function roomTopic(code: string): string {
  return `room-${code.toUpperCase()}`;
}

export async function publish(code: string, event: RealtimeEvent): Promise<void> {
  const url = process.env.SUPABASE_URL || Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

  }
}
