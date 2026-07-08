# Open Markets

A private paper-trading simulator (v1). No real money — six users practise
investing across global markets with realistic **delayed** prices and a **real
FX effect** on returns.

> Built to `SPEC.md`. Only v1 features are in scope.

## Stack

- **Frontend:** React 19 + TypeScript + Vite, installable PWA (`vite-plugin-pwa`)
- **Styling:** Tailwind CSS v4
- **Backend / auth / DB:** Supabase (Postgres + Row Level Security)
- **Market data:** EODHD (delayed prices, FX, fundamentals, news)
- **Money math:** `decimal.js` — no floating-point money errors
- **Hosting target:** Vercel

## Getting started

```bash
npm install
cp .env.example .env   # then paste your credentials
npm run dev
```

### Required credentials (never hardcoded)

Fill these in `.env` (see `.env.example`):

| Variable | Where to get it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `VITE_EODHD_API_KEY` | https://eodhd.com → API tokens (local testing only) |

The app renders a **setup status** panel until Supabase and EODHD are
configured, so you can run it before wiring credentials.

### Database

Apply `supabase/migrations/0001_init.sql` to your Supabase project (SQL editor
or the Supabase CLI). It creates the tables from the SPEC data model plus
snapshot/watchlist tables, all protected by Row Level Security so each user
only sees their own data.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Type-check + production build (emits PWA service worker) |
| `npm run preview` | Preview the production build |
| `npm test` | Run the Vitest suite |

## Architecture notes

### The FX effect is real

Cost basis is locked in the user's **home currency at each trade's FX rate**,
while market value uses the **current FX rate**. Because the two use different
rates, a holding can rise in its native currency yet still lose money in the
home currency. See `src/lib/portfolio.ts` and the proof in
`src/lib/portfolio.test.ts`.

### Money never touches floats

All amounts, prices, quantities and FX rates are `decimal.js` values, persisted
to Postgres `numeric` (exact) as canonical decimal strings. Rounding happens
only at the display boundary (`format()` in `src/lib/money.ts`).

### Rate-limit discipline (data layer)

Delayed prices and FX rates are fetched by a trusted server process — the
`market-refresh` Edge Function (service role, see
`supabase/functions/market-refresh/`) — into `price_cache` / `fx_cache`. The
client only ever reads those cached rows (`src/lib/marketData.ts`) and asks the
function to refresh when a row is missing or older than the 15-minute TTL
(stale-while-revalidate in `src/lib/useMarketData.ts`), so it never polls EODHD
per-render and the free-tier limits stay safe.

### Snapshot cadence (no cron required)

`portfolio_snapshots` rows are written client-side, without a scheduled job:
once per UTC calendar day the user has the app open (ambient, from
`usePortfolio`'s load), plus once more immediately after every trade
(event-based, forced via `TradePage`'s navigation state). See
`src/lib/snapshots.ts` (`isSnapshotDue`). This matches the "daily or per-event"
design already noted on the table and reuses the same
stale-while-revalidate shape as the price/FX cache.

## Build order & status

1. ✅ **Scaffold + schema + money/FX foundation**
2. ✅ **Auth + onboarding** (email/password sign-in, home-currency setup, seeded portfolio)
3. ✅ **Data layer with caching** (`market-refresh` Edge Function + client cache reads, stale-while-revalidate)
4. ✅ **Portfolio + trading + FX UI** (atomic `execute_trade` RPC, valued holdings, dual-currency P&L, order history)
5. ✅ **Portfolio graph** (value-over-time chart, daily + per-trade snapshots, range filters)
6. ⬜ Research page + news
7. ⬜ Search / watchlist / order history
8. ⬜ PWA polish
