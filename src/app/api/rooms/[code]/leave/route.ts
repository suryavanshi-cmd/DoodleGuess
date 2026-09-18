import { authFrom, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    await engine().leave(code, authFrom(request));
    return { left: true };
  });
}
