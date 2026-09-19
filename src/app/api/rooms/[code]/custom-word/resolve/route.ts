import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Host approves or rejects a pending custom word. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ roundId: string; approve: boolean }>(request);
    const game = engine();
    const auth = authFrom(request);
    await game.resolveCustomWord(input.roundId, auth, Boolean(input.approve));
    return game.publicState(code, auth.playerId ?? null);
  });
}
