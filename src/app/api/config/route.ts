import { NextResponse } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export interface PublicConfig {
  /** Project URL, or null when this deployment has no Supabase credentials. */
  supabaseUrl: string | null;
  /** Publishable key. Public by design: RLS blocks every anonymous write. */
  supabaseAnonKey: string | null;
}

/**
 * The browser's Supabase settings, served at request time.
 *
 * `NEXT_PUBLIC_*` values are compiled into the bundle, so setting them on the
 * host does nothing until a build runs that can see them — and a build that
 * reuses its cache silently keeps the old, empty values. That footgun has cost
 * this project a deploy more than once. Reading them here instead means
 * Realtime starts working the moment the credentials exist on the server, with
 * no rebuild at all.
 *
 * Only the two public values are served. The service-role key bypasses RLS and
 * never leaves the server.
 */
export function GET() {
  const config: PublicConfig = {
    supabaseUrl: supabaseUrl()?.value ?? null,
    supabaseAnonKey: supabaseAnonKey()?.value ?? null,
  };
  return NextResponse.json(config, {
    headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" },
  });
}
