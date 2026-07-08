#!/usr/bin/env bash
# ============================================================================
# Open Markets — one-shot backend setup
# ============================================================================
# Applies every migration, sets the EODHD secret (if provided), and deploys
# all three Edge Functions to a Supabase project. Run this ONCE per project
# (it's safe to re-run — migrations and deploys are idempotent).
#
# What this script CANNOT do for you (needs a human, once):
#   1. Create the free Supabase project      -> https://supabase.com/dashboard
#   2. Create the free EODHD account/API key -> https://eodhd.com/register
#      (social login only — Google or GitHub, no email/password form)
#   3. Generate a Supabase personal access token
#      -> https://supabase.com/dashboard/account/tokens
#
# EODHD_API_KEY is OPTIONAL. Without it you still get: auth, the database,
# and trading with manually-entered prices (the Trade screen's "Get price"
# button just won't return anything). What needs it: live cached prices,
# Research (fundamentals/news), and symbol search. Add it later by re-running
# this script, or directly: npx supabase secrets set EODHD_API_KEY=...
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_...   \
#   SUPABASE_PROJECT_REF=abcdefghij \
#   SUPABASE_DB_PASSWORD=...        \
#   [EODHD_API_KEY=...]             \
#   ./scripts/setup-supabase.sh
#
#   SUPABASE_ACCESS_TOKEN  Dashboard -> Account -> Access Tokens -> Generate
#   SUPABASE_PROJECT_REF   Dashboard -> Project Settings -> General -> Reference ID
#   SUPABASE_DB_PASSWORD   The database password you set when creating the
#                          project (Project Settings -> Database, "Reset
#                          database password" if you don't have it anymore)
#   EODHD_API_KEY          (optional) https://eodhd.com -> Settings -> API tokens
# ============================================================================

set -euo pipefail

require() {
  local name=$1
  if [ -z "${!name:-}" ]; then
    echo "Missing required env var: $name" >&2
    echo "See the header of this script for where to find it." >&2
    exit 1
  fi
}

require SUPABASE_ACCESS_TOKEN
require SUPABASE_PROJECT_REF
require SUPABASE_DB_PASSWORD

export SUPABASE_ACCESS_TOKEN

SB="npx --yes supabase@latest"
cd "$(dirname "$0")/.."

echo "==> Linking project ${SUPABASE_PROJECT_REF}"
$SB link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"

echo "==> Applying migrations (0001..0004)"
$SB db push

if [ -n "${EODHD_API_KEY:-}" ]; then
  echo "==> Setting EODHD_API_KEY secret (used by all three functions)"
  $SB secrets set EODHD_API_KEY="$EODHD_API_KEY"
else
  echo "==> Skipping EODHD_API_KEY (not provided) — deploying functions anyway."
  echo "    They'll deploy fine but return an error when called until you set"
  echo "    it: npx supabase secrets set EODHD_API_KEY=... (then re-run this"
  echo "    script, or just that one command)."
fi

echo "==> Deploying Edge Functions"
$SB functions deploy market-refresh
$SB functions deploy research-refresh
$SB functions deploy symbol-search

echo "==> Fetching your project's API keys for the local .env"
$SB projects api-keys --project-ref "$SUPABASE_PROJECT_REF"

cat <<EOF

==============================================================================
Backend setup complete.

Next (local machine, not this script):
  1. cp .env.example .env
  2. Fill in .env:
       VITE_SUPABASE_URL=https://${SUPABASE_PROJECT_REF}.supabase.co
       VITE_SUPABASE_ANON_KEY=<the "anon" key printed above>
     (VITE_EODHD_API_KEY can stay blank either way — the key lives
     server-side now, not in the client.)
  3. npm install
  4. npm run dev

$(if [ -z "${EODHD_API_KEY:-}" ]; then
cat <<'NOTE'
No EODHD key was set, so you can fully test: sign-up, onboarding, and trading
with manually-entered prices/FX. Live prices, Research, and Watchlist search
will error until you add the key later.
NOTE
fi)
==============================================================================
EOF
