#!/usr/bin/env node
/**
 * Copies the game engine into supabase/functions/game/lib for Deno.
 *
 * The authoritative server runs as a Supabase Edge Function because the
 * runtime injects SUPABASE_SERVICE_ROLE_KEY there — the browser-facing host
 * (Vercel) then needs no secrets at all. Rather than fork the logic, we
 * generate the Deno copy from src/lib so there is one source of truth.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "supabase/functions/game/lib");
const supabaseVersion = JSON.parse(
  fs.readFileSync(path.join(root, "node_modules/@supabase/supabase-js/package.json"), "utf8"),
).version;

const SOURCES = [
  "game/text.ts", "game/fuzzy.ts", "game/scoring.ts", "game/mask.ts", "game/filter.ts",
  "game/words.ts", "game/settings.ts", "game/types.ts", "game/engine.ts",
  "store/types.ts", "store/supabase.ts",
  "realtime/server.ts",
];

function rewrite(source, relativePath) {
  const fromDir = path.dirname(relativePath);
  let out = source;

  // Deno has no "server-only" marker; the whole module is server-side here.
  out = out.replace(/^import "server-only";\n/m, "");

  // "@/lib/game/x" -> a relative specifier with the extension Deno requires.
  out = out.replace(/(["'])@\/lib\/([^"']+)\1/g, (_match, quote, target) => {
    let rel = path.relative(fromDir, target);
    if (!rel.startsWith(".")) rel = `./${rel}`;
    return `${quote}${rel}.ts${quote}`;
  });

  // Local relative imports need the extension too.
  out = out.replace(/(from\s+["'])(\.[^"']+?)(["'])/g, (match, head, target, tail) =>
    target.endsWith(".ts") ? match : `${head}${target}.ts${tail}`);

  out = out.replace(/(["'])@supabase\/supabase-js\1/g, `"npm:@supabase/supabase-js@${supabaseVersion}"`);

  // Supabase injects these two into every Edge Function.
  out = out.replace(/process\.env\.NEXT_PUBLIC_SUPABASE_URL/g, 'Deno.env.get("SUPABASE_URL")');
  out = out.replace(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/g, 'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');

  // Comments are stripped: these copies are a deploy payload, and the
  // documented original sits next to them in src/lib.
  out = out
    .replace(/^\s*\/\*\*[\s\S]*?\*\/\s*$/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return `// GENERATED from src/lib/${relativePath} by scripts/build-edge-function.mjs.\n`
    + `// Do not edit — change the original and run \`npm run build:edge\`.\n\n${out}\n`;
}

fs.rmSync(outDir, { recursive: true, force: true });
for (const relativePath of SOURCES) {
  const source = fs.readFileSync(path.join(root, "src/lib", relativePath), "utf8");
  const target = path.join(outDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, rewrite(source, relativePath));
}
console.log(`Generated ${SOURCES.length} modules into supabase/functions/game/lib (supabase-js ${supabaseVersion})`);
