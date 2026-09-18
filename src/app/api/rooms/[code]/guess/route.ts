import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Guesses are judged server-side only; the client never sends a verdict. */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ text: string }>(request);
    return engine().submitGuess(code, authFrom(request), String(input.text ?? ""));
  });
}
