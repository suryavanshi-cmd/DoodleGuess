import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ roundId: string; index: number }>(request);
    const game = engine();
    const auth = authFrom(request);
    await game.chooseWord(input.roundId, auth, Number(input.index));
    // Hand back the new state so the drawer can start drawing immediately
    // rather than waiting for the next poll to notice the turn began.
    return game.publicState(code, auth.playerId ?? null);
  });
}
