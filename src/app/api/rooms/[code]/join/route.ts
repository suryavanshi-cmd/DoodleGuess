import { body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ name: string; avatar?: unknown; token?: string }>(request);
    return engine().joinRoom(code, input);
  });
}
