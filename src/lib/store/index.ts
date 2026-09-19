import "server-only";
import type { GameStore } from "./types";
import { MemoryStore } from "./memory";
import { SupabaseStore, createServiceClient } from "./supabase";
import { supabaseServiceKey, supabaseUrl } from "@/lib/env";

export type { GameStore } from "./types";

const globalForStore = globalThis as unknown as { __doodleStore?: GameStore };

/**
 * Read at request time, and under whichever name the host used — see
 * src/lib/env.ts. NEXT_PUBLIC_* values are inlined at build time, so a
 * deployment that adds them and rebuilds from cache can otherwise leave the
 * server holding a stale one.
 */
export function serverSupabaseUrl(): string | undefined {
  return supabaseUrl()?.value;
}

export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

/**
 * Supabase when credentials are present, otherwise a process-local store so the
 * game is fully playable offline (and in tests). The instance is cached on
 * globalThis to survive dev-server hot reloads.
 */
export function getStore(): GameStore {
  if (globalForStore.__doodleStore) return globalForStore.__doodleStore;
  const url = supabaseUrl();
  const serviceKey = supabaseServiceKey();
  const store: GameStore = url && serviceKey
    ? new SupabaseStore(createServiceClient(url.value, serviceKey.value))
    : new MemoryStore();
  globalForStore.__doodleStore = store;
  return store;
}
