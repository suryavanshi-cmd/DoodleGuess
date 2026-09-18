import { NextResponse } from "next/server";
import { getStore, supabaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Deployment check: says which store is live and proves it answers. In-memory
 * mode is fine locally but breaks across serverless instances, so the UI warns
 * about it in production.
 */
export async function GET() {
  const mode = supabaseConfigured() ? "supabase" : "memory";
  let reachable = true;
  let detail: string | null = null;
  try {
    await getStore().getRoomByCode("HEALTH");
  } catch (error) {
    reachable = false;
    detail = error instanceof Error ? error.message : "unknown error";
  }
  return NextResponse.json(
    { ok: reachable, mode, reachable, detail, realtime: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { status: reachable ? 200 : 503 },
  );
}
