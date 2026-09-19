#!/usr/bin/env bash
# Vercel's "Ignored Build Step": exit 0 to SKIP the build, 1 to run it.
#
# Backend-only commits (Supabase functions, migrations, tests, docs) change
# nothing the browser downloads, so there is no reason to rebuild and
# redeploy the frontend for them — `npm run deploy:be` ships those in seconds.
set -euo pipefail

FRONTEND_PATHS=(
  src public package.json package-lock.json
  next.config.ts tsconfig.json postcss.config.mjs vercel.json
)

# A shallow clone with no parent commit tells us nothing — build to be safe.
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "No parent commit available — building."
  exit 1
fi

if git diff --quiet HEAD^ HEAD -- "${FRONTEND_PATHS[@]}"; then
  echo "No frontend changes in this commit — skipping the build."
  exit 0
fi

echo "Frontend files changed — building."
exit 1
