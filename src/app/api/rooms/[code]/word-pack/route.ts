import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ name: string; words: string }>(request);
    return engine().createWordPack(code, authFrom(request), String(input.name ?? ""), String(input.words ?? ""));
  });
}
