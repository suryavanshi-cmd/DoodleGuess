import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The drawer proposes their own word. Validation is local — no model call. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ roundId: string; word: string; save?: boolean }>(request);
    const game = engine();
    const auth = authFrom(request);
    const result = await game.submitCustomWord(input.roundId, auth, String(input.word ?? ""), {
      save: Boolean(input.save),
    });
    return { status: result.status, state: await game.publicState(code, auth.playerId ?? null) };
  });
}
