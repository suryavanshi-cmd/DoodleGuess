import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The Next.js route handlers and the Supabase Edge Function are two front doors
 * onto the same engine, and the client can be pointed at either with
 * NEXT_PUBLIC_GAME_API. A route added to one and forgotten on the other only
 * shows up as a 404 in production, so compare the two lists here.
 */
const ROUTES_DIR = path.join(process.cwd(), "src/app/api/rooms/[code]");
const EDGE_INDEX = path.join(process.cwd(), "supabase/functions/game/index.ts");

/** Nested route folders flatten into one hyphenated action on the Edge side. */
function actionsFromRoutes(dir: string, prefix = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const name = prefix ? `${prefix}-${entry.name}` : entry.name;
      const child = path.join(dir, entry.name);
      const nested = actionsFromRoutes(child, name);
      return fs.existsSync(path.join(child, "route.ts")) ? [name, ...nested] : nested;
    });
}

describe("route parity", () => {
  const routes = actionsFromRoutes(ROUTES_DIR);
  const edge = new Set(
    [...fs.readFileSync(EDGE_INDEX, "utf8").matchAll(/case "([a-z-]+)":/g)].map((m) => m[1]),
  );
  // "state" is a GET handled before the switch, not a case.
  const handledSeparately = new Set(["state"]);

  it("finds both sets", () => {
    expect(routes.length).toBeGreaterThan(10);
    expect(edge.size).toBeGreaterThan(10);
  });

  it("every Next.js route has an Edge Function action", () => {
    const missing = routes.filter((name) => !edge.has(name) && !handledSeparately.has(name));
    expect(missing).toEqual([]);
  });

  it("every Edge Function action has a Next.js route", () => {
    const missing = [...edge].filter((name) => !routes.includes(name));
    expect(missing).toEqual([]);
  });
});
