import { authFrom, body, engine, handle } from "@/lib/api";
import type { Stroke } from "@/lib/game/types";

export const dynamic = "force-dynamic";

/**
 * The drawer mirrors their canvas here so late joiners and the end-of-round
 * replay have the full stroke list. Live drawing goes over Realtime.
 */
export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ strokes: Stroke[] }>(request);
    await engine().saveStrokes(code, authFrom(request), input.strokes ?? [], true);
    return { saved: true };
  });
}
