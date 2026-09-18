import { authFrom, engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * The authoritative snapshot. Every read reconciles the clock first, so the
 * game advances even if no client happens to be pushing it along.
 */
export async function GET(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(async () => {
    const game = engine();
    const auth = authFrom(request);
    await game.reconcile(code);
    if (auth.playerId && auth.token) {
      await game.authenticate(code, auth).then(
        () => game.heartbeat(code, auth),
        () => undefined,
      );
    }
    return game.publicState(code, auth.playerId ?? null);
  });
}
