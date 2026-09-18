import { authFrom, body, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ text: string }>(request);
    await engine().sendChat(code, authFrom(request), String(input.text ?? ""));
    return { sent: true };
  });
}
