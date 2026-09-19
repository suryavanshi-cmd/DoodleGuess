import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Text mode: submit the clue. Validation is local — no model call. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ roundId: string; text: string }>(request);
    const game = engine();
    const auth = authFrom(request);
    await game.submitClue(input.roundId, auth, String(input.text ?? ""));
    // Return the new state so guessing opens immediately for the Clue-Giver.
    return game.publicState(code, auth.playerId ?? null);
  });
}
