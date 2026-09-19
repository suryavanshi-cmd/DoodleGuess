import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * DoodleGuess authoritative game server.
 *
 * This runs as a Supabase Edge Function rather than as Next.js route handlers
 * because the Edge runtime injects SUPABASE_SERVICE_ROLE_KEY automatically.
 * The browser-facing host therefore needs no secrets: it ships only the
 * project URL and the publishable key, both of which are public by design and
 * useless on their own because RLS blocks every anonymous write.
 *
 * Every rule lives here: guess verdicts, scoring, timers and word secrecy.
 * The client is never trusted with any of it.
 *
 * Shared logic under ./lib is generated from src/lib — run `npm run build:edge`
 * after changing the engine, never edit the copies.
 */
import { GameEngine, GameError, type AuthInput } from "./lib/game/engine.ts";
import { SupabaseStore, createServiceClient } from "./lib/store/supabase.ts";
import type { PowerUpKind } from "./lib/game/scoring.ts";
import type { Stroke } from "./lib/game/types.ts";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-player-id, x-player-token",
  "access-control-max-age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
  });
}

function engine(): GameEngine {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new GameError("The game server is misconfigured.", 500, "no_config");
  return new GameEngine(new SupabaseStore(createServiceClient(url, key)));
}

function authFrom(request: Request): AuthInput {
  return {
    playerId: request.headers.get("x-player-id"),
    token: request.headers.get("x-player-token"),
  };
}

async function body<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new GameError("Expected a JSON body.", 400, "bad_body");
  }
}

/** Strips the function-name prefix so routes read like the REST paths they are. */
function routeOf(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean).filter((part, index, all) => {
    if (part === "functions" && index === 0) return false;
    if (part === "v1" && all[0] === "functions" && index === 1) return false;
    return !(part === "game" && index <= 2);
  });
}

async function route(request: Request): Promise<unknown> {
  const url = new URL(request.url);
  const parts = routeOf(url);
  const method = request.method;
  const game = engine();
  const auth = authFrom(request);

  // /health
  if (parts[0] === "health" && method === "GET") {
    return { ok: true, mode: "supabase", serverTime: new Date().toISOString() };
  }

  // /rooms
  if (parts[0] === "rooms" && parts.length === 1) {
    if (method === "POST") {
      const input = await body<{ name: string; avatar?: unknown; settings?: unknown }>(request);
      const { room, playerId, token } = await game.createRoom(input);
      return { code: room.code, playerId, token, settings: room.settings };
    }
    if (method === "GET") return { rooms: await game.listPublicRooms() };
  }

  // /rooms/:code/:action
  if (parts[0] === "rooms" && parts.length === 3) {
    const code = parts[1];
    const action = parts[2];

    if (action === "state" && method === "GET") {
      await game.reconcile(code);
      if (auth.playerId && auth.token) {
        await game.authenticate(code, auth).then(() => game.heartbeat(code, auth), () => undefined);
      }
      return game.publicState(code, auth.playerId ?? null);
    }
    if (method !== "POST") throw new GameError("Method not allowed.", 405, "bad_method");

    switch (action) {
      case "join": {
        const input = await body<{ name: string; avatar?: unknown; token?: string }>(request);
        return game.joinRoom(code, input);
      }
      case "start":
        await game.startGame(code, auth);
        return { started: true };
      case "settings": {
        const input = await body<{ settings: unknown }>(request);
        await game.updateSettings(code, auth, input.settings);
        return { updated: true };
      }
      case "choose": {
        const input = await body<{ roundId: string; index: number }>(request);
        await game.chooseWord(input.roundId, auth, Number(input.index));
        // Return the new state so the drawer can draw at once.
        return game.publicState(code, auth.playerId ?? null);
      }
      case "clue": {
        const input = await body<{ roundId: string; text: string }>(request);
        await game.submitClue(input.roundId, auth, String(input.text ?? ""));
        return game.publicState(code, auth.playerId ?? null);
      }
      case "clue-suggestion": {
        const input = await body<{ roundId: string }>(request);
        return game.clueSuggestions(input.roundId, auth);
      }
      case "clue-vote": {
        const input = await body<{ clueId: string }>(request);
        await game.upvoteClue(code, auth, String(input.clueId ?? ""));
        return { voted: true };
      }
      case "guess": {
        const input = await body<{ text: string }>(request);
        return game.submitGuess(code, auth, String(input.text ?? ""));
      }
      case "chat": {
        const input = await body<{ text: string }>(request);
        await game.sendChat(code, auth, String(input.text ?? ""));
        return { sent: true };
      }
      case "powerup": {
        const input = await body<{ kind: PowerUpKind; targetId?: string }>(request);
        return game.usePowerUp(code, auth, input.kind, input.targetId);
      }
      case "reaction": {
        const allowed = ["👏", "🔥", "😂", "😮", "❤️", "🎨"];
        const input = await body<{ emoji: string }>(request);
        const { player } = await game.authenticate(code, auth);
        const emoji = allowed.includes(input.emoji) ? input.emoji : allowed[0];
        const { publish } = await import("./lib/realtime/server.ts");
        await publish(code, { type: "reaction", playerId: player.id, emoji, at: Date.now() });
        return { sent: true };
      }
      case "strokes": {
        const input = await body<{ strokes: Stroke[] }>(request);
        await game.saveStrokes(code, auth, input.strokes ?? [], true);
        return { saved: true };
      }
      case "word-pack": {
        const input = await body<{ name: string; words: string }>(request);
        return game.createWordPack(code, auth, String(input.name ?? ""), String(input.words ?? ""));
      }
      case "leave":
        await game.leave(code, auth);
        return { left: true };
      case "heartbeat":
        await game.heartbeat(code, auth);
        return { alive: true };
    }
  }

  // /rounds/:id/strokes
  if (parts[0] === "rounds" && parts[2] === "strokes" && method === "GET") {
    return { strokes: await game.listStrokes(parts[1]) };
  }

  throw new GameError("No such endpoint.", 404, "no_route");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    return json({ ok: true, data: await route(request) });
  } catch (error) {
    if (error instanceof GameError) {
      return json({ ok: false, error: error.message, code: error.code }, error.status);
    }
    console.error("[doodleguess]", error);
    return json({ ok: false, error: "Something went wrong on our side.", code: "server_error" }, 500);
  }
});
