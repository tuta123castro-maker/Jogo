# Testing Open Markets end-to-end

This app talks to a real Supabase project and (optionally, for now) EODHD.
This doc is the complete path from zero to a working app.

## What needs a human (can't be scripted)

This needs email verification / ToS acceptance, so it can't be automated —
everything after it is one script.

1. **Create a free Supabase project** — <https://supabase.com/dashboard>

While you're in the dashboard, also grab:

- A **personal access token**: Account → Access Tokens → Generate
- Your **project reference ID**: Project Settings → General
- Your **database password** (set at project creation — Project Settings →
  Database → "Reset database password" if you've lost it)

**EODHD is optional for now.** Skip it and come back later — see
"Testing without EODHD" below for what still works. When you're ready:
<https://eodhd.com/register> (social login only — Google or GitHub, there's no
email/password form) → Settings → API tokens. Free tier is 20 calls/day.

## Automated backend setup

With the three Supabase values (EODHD key optional):

```bash
SUPABASE_ACCESS_TOKEN=sbp_...   \
SUPABASE_PROJECT_REF=abcdefghij \
SUPABASE_DB_PASSWORD=...        \
[EODHD_API_KEY=...]             \
./scripts/setup-supabase.sh
```

This applies all 4 SQL migrations, sets the `EODHD_API_KEY` secret (if given),
and deploys all 3 Edge Functions (`market-refresh`, `research-refresh`,
`symbol-search`) regardless — they just error when called until the key
exists. It's safe to re-run, including later just to add the key:
`npx supabase secrets set EODHD_API_KEY=...`. At the end it prints your
project's API keys for the next step.

## Run it locally

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the script's output
npm install
npm run dev
```

## Automated checks (no backend needed)

```bash
npm test        # 40 unit tests — money/FX math, valuation, caching, chart geometry
npm run build   # type-check + production build
```

## Manual click-through checklist

Do these in order — later steps depend on earlier ones.

### Testing without EODHD

Everything except live quotes, Research, and search works today — the Trade
screen's "Get price" button just won't return anything, so type the price and
FX rate in by hand instead. Skip steps 6–7 below for now.

| # | Step | What confirms it worked |
|---|------|--------------------------|
| 1 | Sign up (email + password) | Lands on the onboarding screen |
| 2 | Onboarding — pick a home currency | Portfolio shows starting cash in that currency |
| 3 | **Trade** — buy a symbol, **manually entering** a price and native currency **different from home** (e.g. home = USD, buy `7203.T`, price `2500`, currency `JPY`, FX rate `0.0067`) | This is the core feature: cost basis locks in home currency at that trade's FX rate |
| 4 | Portfolio tab | Holding shows a home-currency value + unrealized P&L (recompute it by hand: quantity × price × FX rate); value-over-time graph has started |
| 5 | Sell part of that holding (enter a price again) | Cash balance increases; holding quantity drops; a second trade appears in Orders |
| 8 | Orders tab | Both trades from steps 3 and 5 are listed with their FX rate |
| 9 | Turn off wifi/data | Offline banner appears at the top |
| 10 | (Optional, a day later) Open the app again | A new point appears on the portfolio graph even without trading — the daily ambient snapshot |

### Once EODHD is added

| # | Step | What confirms it worked |
|---|------|--------------------------|
| 3′ | Trade — click "Get price" on a real symbol instead of typing it | Price/currency/FX autofill from the live quote |
| 6 | Research tab — search a company by name | Typeahead shows matches; selecting one loads fundamentals + news |
| 7 | Star a symbol from Research | Watchlist tab shows it with a live price |

If something breaks, the browser console + Network tab (Supabase calls) are
the first place to look — every data call goes through `src/lib/*.ts`, named
after what it does (`marketData.ts`, `trading.ts`, `research.ts`, etc.).

## Known gap

`SPEC.md` — referenced in the README as the source of truth for v1 scope — was
never committed to this repo. Everything here was built against reasonable
defaults (documented inline, e.g. `STARTING_CASH` in `src/lib/profile.ts`)
rather than the original spec. Worth a diff-check against the real spec if you
still have it.
