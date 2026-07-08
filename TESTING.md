# Testing Open Markets end-to-end

This app talks to a real Supabase project and EODHD, so a full test needs a
live backend. This doc is the complete path from zero to a working app.

## What needs a human (can't be scripted)

These two steps need email verification / ToS acceptance, so they can't be
automated — everything after them is one script.

1. **Create a free Supabase project** — <https://supabase.com/dashboard>
2. **Create a free EODHD account + API key** — <https://eodhd.com> (Settings →
   API tokens)

While you're in the Supabase dashboard, also grab:

- A **personal access token**: Account → Access Tokens → Generate
- Your **project reference ID**: Project Settings → General
- Your **database password** (set at project creation — Project Settings →
  Database → "Reset database password" if you've lost it)

## Automated backend setup

Once you have the four values above, run:

```bash
SUPABASE_ACCESS_TOKEN=sbp_...   \
SUPABASE_PROJECT_REF=abcdefghij \
SUPABASE_DB_PASSWORD=...        \
EODHD_API_KEY=...               \
./scripts/setup-supabase.sh
```

This applies all 4 SQL migrations, sets the `EODHD_API_KEY` secret, and
deploys all 3 Edge Functions (`market-refresh`, `research-refresh`,
`symbol-search`). It's safe to re-run. At the end it prints your project's API
keys for the next step.

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

Do these in order — later steps depend on earlier ones:

| # | Step | What confirms it worked |
|---|------|--------------------------|
| 1 | Sign up (email + password) | Lands on the onboarding screen |
| 2 | Onboarding — pick a home currency | Portfolio shows starting cash in that currency |
| 3 | **Trade** — buy a symbol listed in a **different currency** than home (e.g. home = USD, buy `7203.T`, a JPY-listed Tokyo stock) | This is the core feature: cost basis locks in home currency at that trade's FX rate |
| 4 | Portfolio tab | Holding shows a home-currency value + unrealized P&L; value-over-time graph has started |
| 5 | Sell part of that holding | Cash balance increases; holding quantity drops; a second trade appears in Orders |
| 6 | Research tab — search a company by name | Typeahead shows matches; selecting one loads fundamentals + news |
| 7 | Star a symbol from Research | Watchlist tab shows it with a live price |
| 8 | Orders tab | Both trades from steps 3 and 5 are listed with their FX rate |
| 9 | Turn off wifi/data | Offline banner appears at the top |
| 10 | (Optional, a day later) Open the app again | A new point appears on the portfolio graph even without trading — the daily ambient snapshot |

If something breaks, the browser console + Network tab (Supabase calls) are
the first place to look — every data call goes through `src/lib/*.ts`, named
after what it does (`marketData.ts`, `trading.ts`, `research.ts`, etc.).

## Known gap

`SPEC.md` — referenced in the README as the source of truth for v1 scope — was
never committed to this repo. Everything here was built against reasonable
defaults (documented inline, e.g. `STARTING_CASH` in `src/lib/profile.ts`)
rather than the original spec. Worth a diff-check against the real spec if you
still have it.
