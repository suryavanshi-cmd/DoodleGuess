import "server-only";
import type { GameStore } from "./types";
import { MemoryStore } from "./memory";
import { SupabaseStore, createServiceClient } from "./supabase";

export type { GameStore } from "./types";

const globalForStore = globalThis as unknown as { __doodleStore?: GameStore };

/**
 * NEXT_PUBLIC_* values are inlined at build time, so a deployment that adds
 * them and rebuilds from cache can leave the server holding a stale one.
 * SUPABASE_URL is read at runtime and wins when present.
 */
export function serverSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function supabaseConfigured(): boolean {
  return Boolean(serverSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Supabase when credentials are present, otherwise a process-local store so the
 * game is fully playable offline (and in tests). The instance is cached on
 * globalThis to survive dev-server hot reloads.
 */
export function getStore(): GameStore {
  if (globalForStore.__doodleStore) return globalForStore.__doodleStore;
  const store: GameStore = supabaseConfigured()
    ? new SupabaseStore(
        createServiceClient(
          serverSupabaseUrl() as string,
          process.env.SUPABASE_SERVICE_ROLE_KEY as string,
        ),
      )
    : new MemoryStore();
  globalForStore.__doodleStore = store;
  return store;
}
