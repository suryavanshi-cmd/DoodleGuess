import "server-only";
import type { GameStore } from "./types";
import { MemoryStore } from "./memory";
import { SupabaseStore, createServiceClient } from "./supabase";

export type { GameStore } from "./types";

const globalForStore = globalThis as unknown as { __doodleStore?: GameStore };

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
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
          process.env.NEXT_PUBLIC_SUPABASE_URL as string,
          process.env.SUPABASE_SERVICE_ROLE_KEY as string,
        ),
      )
    : new MemoryStore();
  globalForStore.__doodleStore = store;
  return store;
}
