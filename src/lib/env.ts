import "server-only";

/**
 * Finding the Supabase credentials whatever the host called them.
 *
 * Three things hand these to a deployment and none of them agree on names:
 * pasting them by hand gives `NEXT_PUBLIC_SUPABASE_*`, Vercel's Supabase
 * integration gives `SUPABASE_URL` / `SUPABASE_ANON_KEY` (sometimes behind a
 * prefix of its own), and Supabase's newer key scheme calls them
 * `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. Reading only one
 * spelling means a project that is genuinely connected still falls back to
 * in-memory rooms, which is indistinguishable from not being connected at all.
 *
 * So: try the known names in order, then, only if none matched, scan for a
 * prefixed variant. Every lookup reports the name it used so /api/health can
 * say what it found instead of leaving it to guesswork.
 */

export interface EnvHit {
  /** The variable the value came from, for diagnostics. Never the value. */
  name: string;
  value: string;
}

/** Exact names first — an explicit match always beats a scanned one. */
const URL_NAMES = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const;
const ANON_NAMES = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY",
] as const;
const SERVICE_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"] as const;

/** Suffixes a prefixed variant would end with, e.g. STORAGE_SUPABASE_URL. */
const URL_SUFFIXES = ["SUPABASE_URL"] as const;
const ANON_SUFFIXES = ["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"] as const;
const SERVICE_SUFFIXES = ["SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"] as const;

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function find(names: readonly string[], suffixes: readonly string[]): EnvHit | null {
  for (const name of names) {
    const value = read(name);
    if (value) return { name, value };
  }
  for (const name of Object.keys(process.env).sort()) {
    if (!suffixes.some((suffix) => name.endsWith(suffix))) continue;
    const value = read(name);
    if (value) return { name, value };
  }
  return null;
}

/**
 * The project URL. Checked for shape because a scanned name could otherwise
 * pick up something that merely ends in _SUPABASE_URL, and a bad URL fails
 * later as a confusing network error instead of a clear misconfiguration.
 */
export function supabaseUrl(): EnvHit | null {
  const hit = find(URL_NAMES, URL_SUFFIXES);
  if (!hit) return null;
  try {
    const parsed = new URL(hit.value);
    return parsed.protocol === "https:" ? hit : null;
  } catch {
    return null;
  }
}

/** Publishable/anon key. Public by design — it is sent to the browser. */
export function supabaseAnonKey(): EnvHit | null {
  return find(ANON_NAMES, ANON_SUFFIXES);
}

/** Service-role key. Bypasses RLS, so it never leaves the server. */
export function supabaseServiceKey(): EnvHit | null {
  return find(SERVICE_NAMES, SERVICE_SUFFIXES);
}

/**
 * Every Supabase-shaped variable name this environment holds, values dropped.
 * When a deployment insists it is connected but the game still runs on memory
 * rooms, this is what tells us whether the credentials are absent or merely
 * under a name nothing reads.
 */
export function supabaseEnvNames(): string[] {
  return Object.keys(process.env)
    .filter((name) => /SUPABASE|POSTGRES/i.test(name))
    .sort();
}
