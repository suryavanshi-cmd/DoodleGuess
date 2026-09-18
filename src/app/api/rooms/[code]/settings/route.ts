import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ settings: unknown }>(request);
    await engine().updateSettings(code, authFrom(request), input.settings);
    return { updated: true };
  });
}
