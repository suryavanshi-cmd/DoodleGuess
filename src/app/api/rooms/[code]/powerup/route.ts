import { authFrom, body, engine, handle } from "@/lib/api";
import type { PowerUpKind } from "@/lib/game/scoring";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const input = await body<{ kind: PowerUpKind; targetId?: string }>(request);
    return engine().usePowerUp(code, authFrom(request), input.kind, input.targetId);
  });
}
