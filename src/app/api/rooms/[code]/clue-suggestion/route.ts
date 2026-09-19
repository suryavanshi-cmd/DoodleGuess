import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * "Need inspiration?" — reads the bundled clue bank plus clues contributed by
 * players. A database lookup, never a generated suggestion.
 */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  await ctx.params;
  return handle(async () => {
    const input = await body<{ roundId: string }>(request);
    return engine().clueSuggestions(input.roundId, authFrom(request));
  });
}
