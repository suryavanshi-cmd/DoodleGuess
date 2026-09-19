import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The production build does not re-run tsc: `npm run verify` (and the
  // verify job in CI) type-checks, lints and tests before anything ships,
  // and repeating it here costs a third of the build for no new information.
  // Next 16 no longer runs ESLint during `next build` at all.
  typescript: { ignoreBuildErrors: true },

  headers() {
    return [
      {
        // The classifier's weights are served from /public, which Next sends
        // with max-age=0 — so every visit revalidates a file that by
        // construction never changes: the version is in its name, and a new
        // model is a new name. Immutable means it is downloaded once per
        // device and read from disk on every later turn.
        source: "/models/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
