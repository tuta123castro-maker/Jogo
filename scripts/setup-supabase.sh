#!/usr/bin/env bash
# ============================================================================
# Open Markets — one-shot backend setup
# ============================================================================
# Applies every migration, sets the EODHD secret, and deploys all three Edge
# Functions to a Supabase project. Run this ONCE per project (it's safe to
# re-run — migrations and deploys are idempotent).
#
# What this script CANNOT do for you (needs a human, once):
#   1. Create the free Supabase project      -> https://supabase.com/dashboard
#   2. Create the free EODHD account/API key -> https://eodhd.com
#   3. Generate a Supabase personal access token
#      -> https://supabase.com/dashboard/account/tokens
#
# Everything else — running the 4 SQL migrations in order, setting secrets,
# deploying market-refresh / research-refresh / symbol-search — is automated
# below via `npx supabase` (no global CLI install required).
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_...   \
#   SUPABASE_PROJECT_REF=abcdefghij \
#   SUPABASE_DB_PASSWORD=...        \
#   EODHD_API_KEY=...               \
#   ./scripts/setup-supabase.sh
#
#   SUPABASE_ACCESS_TOKEN  Dashboard -> Account -> Access Tokens -> Generate
#   SUPABASE_PROJECT_REF   Dashboard -> Project Settings -> General -> Reference ID
#   SUPABASE_DB_PASSWORD   The database password you set when creating the
#                          project (Project Settings -> Database, "Reset
#                          database password" if you don't have it anymore)
#   EODHD_API_KEY          https://eodhd.com -> Settings -> API tokens
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
require EODHD_API_KEY

export SUPABASE_ACCESS_TOKEN

SB="npx --yes supabase@latest"
cd "$(dirname "$0")/.."

echo "==> Linking project ${SUPABASE_PROJECT_REF}"
$SB link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"

echo "==> Applying migrations (0001..0004)"
$SB db push

echo "==> Setting EODHD_API_KEY secret (used by all three functions)"
$SB secrets set EODHD_API_KEY="$EODHD_API_KEY"

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
     (VITE_EODHD_API_KEY can stay blank — the key lives server-side now.)
  3. npm install
  4. npm run dev
==============================================================================
EOF
