import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  await ctx.params;
  return handle(async () => {
    const input = await body<{ roundId: string; index: number }>(request);
    await engine().chooseWord(input.roundId, authFrom(request), Number(input.index));
    return { chosen: true };
  });
}
