import { body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Create a room. The creator becomes the host and gets a player token back. */
export async function POST(request: Request) {
  return handle(async () => {
    const input = await body<{ name: string; avatar?: unknown; settings?: unknown }>(request);
    const { room, playerId, token } = await engine().createRoom(input);
    return { code: room.code, playerId, token, settings: room.settings };
  });
}

/** Public rooms anyone can drop into. */
export async function GET() {
  return handle(async () => ({ rooms: await engine().listPublicRooms() }));
}
