import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Save a word to the player's own list, or read the list back. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ word?: string }>(request);
    const game = engine();
    const auth = authFrom(request);
    return input.word ? game.saveMyWord(code, auth, input.word) : game.listMyWords(code, auth);
  });
}
