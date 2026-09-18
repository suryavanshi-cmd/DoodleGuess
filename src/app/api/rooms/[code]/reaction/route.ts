import { authFrom, body, engine, handle } from "@/lib/api";
import { publish } from "@/lib/realtime/server";

export const dynamic = "force-dynamic";

const ALLOWED = ["👏", "🔥", "😂", "😮", "❤️", "🎨"];

/** Emoji reactions bypass chat entirely so they cannot be used to spam. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ emoji: string }>(request);
    const { player } = await engine().authenticate(code, authFrom(request));
    const emoji = ALLOWED.includes(input.emoji) ? input.emoji : ALLOWED[0];
    await publish(code, { type: "reaction", playerId: player.id, emoji, at: Date.now() });
    return { sent: true };
  });
}
