#!/usr/bin/env bash
# Atomic zero-downtime deploy for the pulito Next.js app.
#
# Why this exists: `npm run build` overwrites .next/ in place while the live
# `next start` is still serving. Mid-build, the old server reads a half-written
# prerender-manifest.json / client-reference-manifest and throws InvariantError
# + HTTP 500 at real visitors hitting /uk, /uk/contacts, /uk/bundles, etc.
#
# Fix: build into a fresh .next-staging, run the same gates we deploy by hand
# (tsc app-errors == 0, "Compiled successfully", BUILD_ID present, no type
# failure), then swap it into place with two instant mv renames and reload PM2.
# The old server keeps its open .next file descriptors valid across the rename
# (Linux), so in-flight requests never see a missing file.
set -euo pipefail

cd "$(dirname "$0")"

STAGING=".next-staging"
LIVE=".next"
PREV=".next-prev"
LOG="/tmp/pulito-deploy.log"

echo "[deploy] cleaning stale staging…"
rm -rf "$STAGING"

# Gate 0: full typecheck (includes tests — `next build` only checks app code).
echo "[deploy] typecheck (tsc --noEmit)…"
npx tsc --noEmit > /tmp/pulito-typecheck.log 2>&1 || {
  echo "[deploy] TYPECHECK FAILED — not deploying. Tail:";
  tail -20 /tmp/pulito-typecheck.log; exit 1;
}

echo "[deploy] building into $STAGING (this takes a few minutes)…"
rm -f .next/cache/*.lock 2>/dev/null || true
# Snapshot the slugRedirect table into a static map the Edge/Node middleware
# imports (src/generated/slug-redirects.ts). Non-fatal: keeps existing file on
# DB error so a transient blip can't break the build.
node scripts/gen-slug-redirects.cjs || echo "[deploy] WARN: slug-redirects gen failed, using existing"
# `next build` rewrites tsconfig.json (adds distDir-specific include globs).
# Snapshot it and restore afterwards so the staging dir name never leaks into
# the committed config. `.next-staging` is already in tsconfig `exclude`, so the
# route-type validators there are skipped exactly like the normal `.next` build.
cp tsconfig.json /tmp/pulito-tsconfig.bak 2>/dev/null || true
# BUILD_ID scopes the service-worker caches to this deploy (next.config.ts ->
# NEXT_PUBLIC_SW_VERSION -> public/sw.js). A fresh value each build makes returning
# visitors' browsers reinstall the worker and drop the previous build's caches.
NEXT_DIST_DIR="$STAGING" BUILD_ID="$(date +%s)" NODE_OPTIONS='--max-old-space-size=3072' \
  npx next build --webpack > "$LOG" 2>&1 || { echo "[deploy] BUILD CRASHED"; tail -20 "$LOG"; cp /tmp/pulito-tsconfig.bak tsconfig.json 2>/dev/null || true; exit 1; }
cp /tmp/pulito-tsconfig.bak tsconfig.json 2>/dev/null || true

# Gate: the build must have actually succeeded and produced a usable tree.
# Accept both "Compiled successfully" and "Compiled with warnings" — Next prints
# the latter for benign webpack warnings (e.g. the @opentelemetry/Sentry
# "Critical dependency" notice), which must NOT block a deploy. Real failures
# still trip the "Failed to compile / Failed to type check" guard + missing BUILD_ID.
if ! grep -qE "Compiled successfully|Compiled with warnings" "$LOG" \
   || grep -q "Failed to compile\|Failed to type check" "$LOG" \
   || [ ! -f "$STAGING/BUILD_ID" ]; then
  echo "[deploy] BUILD FAILED — not deploying. Tail:"
  grep -iE "Failed|Type error|error TS" "$LOG" | head -10
  rm -rf "$STAGING"
  exit 1
fi
echo "[deploy] build OK, BUILD_ID=$(cat "$STAGING/BUILD_ID")"

# Atomic swap: two renames on the same filesystem = milliseconds.
echo "[deploy] swapping $STAGING -> $LIVE…"
rm -rf "$PREV"
[ -d "$LIVE" ] && mv "$LIVE" "$PREV"
mv "$STAGING" "$LIVE"

echo "[deploy] reloading PM2…"
pm2 reload pulito --update-env >/dev/null 2>&1 || pm2 restart pulito --update-env >/dev/null 2>&1

# Health gate — roll back if the new build doesn't come up.
ok=0
for i in $(seq 1 12); do
  sleep 3
  code=$(curl -s -m 8 -o /dev/null -w '%{http_code}' http://localhost:3000/api/v1/health 2>/dev/null || echo 000)
  echo "[deploy] health attempt $i: $code"
  if [ "$code" = "200" ]; then ok=1; break; fi
done

if [ "$ok" != "1" ]; then
  echo "[deploy] HEALTH CHECK FAILED — rolling back to previous build."
  if [ -d "$PREV" ]; then
    rm -rf "$LIVE"
    mv "$PREV" "$LIVE"
    pm2 reload pulito --update-env >/dev/null 2>&1 || pm2 restart pulito --update-env >/dev/null 2>&1
    echo "[deploy] rolled back."
  fi
  exit 1
fi

echo "[deploy] DEPLOYED OK. health=200 BUILD_ID=$(cat "$LIVE/BUILD_ID")"
echo "[deploy] previous build kept at $PREV (delete when satisfied)."

# Post-deploy admin smoke (non-blocking gate): opens all static /admin pages
# in a real authenticated browser and catches client-runtime crashes that the
# health check can't see. Site is already live at this point, so a failure
# does NOT roll back automatically — it prints the broken pages and exits 3
# so the operator notices. Skip with SKIP_SMOKE=1 (e.g. emergency hotfix).
if [ "${SKIP_SMOKE:-0}" != "1" ]; then
  echo "[deploy] admin smoke (~2 min, SKIP_SMOKE=1 to skip)…"
  SMOKE_CREDS=$(mktemp)
  chmod 600 "$SMOKE_CREDS"
  SMOKE_FAILED=0
  if node scripts/e2e-temp-admin.cjs create > "$SMOKE_CREDS" 2>/dev/null; then
    set -a; . "$SMOKE_CREDS"; set +a
    if PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test e2e/admin-smoke.spec.ts         --project=chromium --reporter=line > /tmp/pulito-smoke.log 2>&1; then
      echo "[deploy] SMOKE OK — every admin page renders without client errors."
    else
      SMOKE_FAILED=1
      echo "[deploy] !!! SMOKE FAILED — site is live, but admin pages have client errors:"
      grep -E '→|failed|Error' /tmp/pulito-smoke.log | head -15 || true
      echo "[deploy] full log: /tmp/pulito-smoke.log"
    fi
    node scripts/e2e-temp-admin.cjs delete >/dev/null 2>&1 || \
      echo "[deploy] WARN: failed to delete e2e-smoke@internal.local — remove it manually!"
  else
    echo "[deploy] WARN: smoke skipped — could not create the temp admin."
  fi
  rm -f "$SMOKE_CREDS"
  if [ "$SMOKE_FAILED" = "1" ]; then exit 3; fi
fi
