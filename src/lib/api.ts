import "server-only";
import { NextResponse } from "next/server";
import { GameEngine, GameError, type AuthInput } from "@/lib/game/engine";
import { getStore } from "@/lib/store";

export function engine(): GameEngine {
  return new GameEngine(getStore());
}

/** Player identity travels in headers, never in the URL, so it stays out of logs. */
export function authFrom(request: Request): AuthInput {
  return {
    playerId: request.headers.get("x-player-id"),
    token: request.headers.get("x-player-token"),
  };
}

export async function body<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new GameError("Expected a JSON body.", 400, "bad_body");
  }
}

export async function handle<T>(work: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json({ ok: true, data: await work() });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[doodleguess]", error);
    return NextResponse.json(
      { ok: false, error: "Something went wrong on our side.", code: "server_error" },
      { status: 500 },
    );
  }
}
