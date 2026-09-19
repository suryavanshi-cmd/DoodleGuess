import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Upvote a clue so the good ones rise in the bank. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ clueId: string }>(request);
    await engine().upvoteClue(code, authFrom(request), String(input.clueId ?? ""));
    return { voted: true };
  });
}
