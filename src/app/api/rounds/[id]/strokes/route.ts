import { engine, handle } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Stroke list for the end-of-round replay and for clients joining mid-turn. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => ({ strokes: await engine().listStrokes(id) }));
}
