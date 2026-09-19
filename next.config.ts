import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The production build does not re-run tsc: `npm run verify` (and the
  // verify job in CI) type-checks, lints and tests before anything ships,
  // and repeating it here costs a third of the build for no new information.
  // Next 16 no longer runs ESLint during `next build` at all.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
