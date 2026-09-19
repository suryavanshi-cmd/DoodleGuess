import { NextResponse } from "next/server";
import { supabaseAnonKey, supabaseEnvNames, supabaseServiceKey, supabaseUrl } from "@/lib/env";
import { getStore, supabaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Deployment check. Reports which credentials were found and the variable name
 * each came from — never a value — so a misconfigured deployment says exactly
 * what is wrong instead of silently falling back to in-memory rooms.
 *
 * `env` lists every Supabase-shaped variable name the server can see. When a
 * project is genuinely connected but the game still runs on memory rooms, that
 * list is the difference between "the credentials are missing" and "they are
 * here under a name nothing was reading".
 */
export async function GET() {
  const url = supabaseUrl();
  const anon = supabaseAnonKey();
  const service = supabaseServiceKey();

  const found = {
    url: url?.name ?? null,
    anonKey: anon?.name ?? null,
    serviceRoleKey: service?.name ?? null,
  };
  const missing = Object.entries(found).filter(([, name]) => !name).map(([key]) => key);

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
    {
      ok: reachable,
      mode,
      reachable,
      detail,
      found,
      missing,
      /** Names only. Present so a "but it is connected" can be checked, not argued. */
      env: supabaseEnvNames(),
      // The browser gets these from /api/config at runtime, so Realtime no
      // longer depends on NEXT_PUBLIC_* having been set at build time.
      realtime: Boolean(url && anon),
    },
    { status: reachable ? 200 : 503 },
  );
}
