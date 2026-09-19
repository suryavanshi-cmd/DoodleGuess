import { NextResponse } from "next/server";
import { getStore, serverSupabaseUrl, supabaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Deployment check. Reports which variables are present — never their values —
 * so a misconfigured deployment says exactly what is missing instead of
 * silently falling back to in-memory rooms that vanish between requests.
 */
export async function GET() {
  const present = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(serverSupabaseUrl()),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const missing = Object.entries(present).filter(([, ok]) => !ok).map(([name]) => name);

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
    { ok: reachable, mode, reachable, detail, missing, realtime: present.NEXT_PUBLIC_SUPABASE_URL },
    { status: reachable ? 200 : 503 },
  );
}
