#!/usr/bin/env node
/**
 * Type-free smoke test for the Deno bundle: resolve and parse every module the
 * Edge Function imports, so a missing file or a syntax error surfaces here
 * rather than halfway through `supabase functions deploy`.
 */
import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Deno resolves these at runtime; esbuild only needs to skip them.
const denoSpecifiers = {
  name: "deno-specifiers",
  setup(build) {
    build.onResolve({ filter: /^(npm|jsr|node|https?):/ }, (args) => ({
      path: args.path, external: true,
    }));
  },
};

try {
  const result = await esbuild.build({
    entryPoints: [path.join(root, "supabase/functions/game/index.ts")],
    bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022",
    plugins: [denoSpecifiers], logLevel: "silent",
  });
  const bytes = result.outputFiles[0].contents.byteLength;
  console.log(`Edge Function resolves cleanly (${(bytes / 1024).toFixed(0)} kB bundled).`);
} catch (error) {
  console.error("Edge Function did not resolve:\n");
  for (const message of error.errors ?? []) {
    console.error(`  ${message.location?.file ?? "?"}:${message.location?.line ?? "?"} ${message.text}`);
  }
  process.exit(1);
}
