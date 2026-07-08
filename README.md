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

**Full setup + a manual test checklist: see [`TESTING.md`](./TESTING.md).**
Short version:

```bash
npm install
cp .env.example .env   # then paste your credentials
npm run dev
```

The app renders a **setup status** panel until Supabase is configured, so you
can run it before wiring credentials.

### Backend setup (database + Edge Functions)

`./scripts/setup-supabase.sh` applies all 4 SQL migrations
(`supabase/migrations/`), sets the `EODHD_API_KEY` secret (optional — you can
add it later), and deploys all 3 Edge Functions (`market-refresh`,
`research-refresh`, `symbol-search`) in one run — see the script's header or
`TESTING.md` for the values it needs and where to get them. Everything it does
is idempotent, so it's safe to re-run.

### Required credentials (never hardcoded)

Fill these in `.env` (see `.env.example`):

| Variable | Where to get it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `VITE_EODHD_API_KEY` | Not needed locally — the key lives server-side in the Edge Functions (see above). Only set this for early testing before the functions are deployed. |

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

### Research data (fundamentals + news)

Fundamentals and news follow the same client-never-calls-EODHD rule as prices,
but via a separate `research-refresh` Edge Function
(`supabase/functions/research-refresh/`) with much longer TTLs — fundamentals
for a day, news for an hour — since this data barely moves compared to a live
quote. Cached in `fundamentals_cache` / `news_cache`
(`supabase/migrations/0003_research_cache.sql`); read client-side from
`src/lib/research.ts`.

### Symbol search

`symbol-search` (`supabase/functions/symbol-search/`) is the only process that
calls EODHD's ticker search. It differs from the other Edge Functions: the
client never reads its cache table directly (`symbol_search_cache` has RLS
enabled with **no** policies — every client role is denied; only the
service role can touch it). Instead the function returns results straight in
its response, like any search-as-you-type endpoint, while still caching by
normalized query server-side (7-day TTL) to save repeat EODHD calls across the
small user pool. The client debounces keystrokes 300ms before calling it
(`src/lib/useSymbolSearch.ts`).

### PWA behavior

- **Offline banner** (`src/components/OfflineBanner.tsx`) — every screen needs
  a Supabase round trip, so a `navigator`-online hook surfaces "you're
  offline" instead of letting each call fail silently.
- **Update prompt** (`src/components/UpdatePrompt.tsx`) — installed PWAs are
  often left open for days; `registerType: 'autoUpdate'` alone would leave a
  new version cached but never applied, so this uses
  `virtual:pwa-register/react` to offer a reload once one's ready, and confirms
  the first install is available offline.
- **Offline deep links** — `workbox.navigateFallback` in `vite.config.ts`
  serves the cached app shell for any unmatched navigation, so opening the
  installed app to `/research` (client-routed) while offline still loads
  instead of failing.
- **Code-splitting** — every page but the Portfolio landing page is
  `React.lazy`-loaded, and `manualChunks` separates React/Supabase vendor code
  from app code, so a redeploy doesn't force everyone to re-download the
  vendor bundle.

## Build order & status

1. ✅ **Scaffold + schema + money/FX foundation**
2. ✅ **Auth + onboarding** (email/password sign-in, home-currency setup, seeded portfolio)
3. ✅ **Data layer with caching** (`market-refresh` Edge Function + client cache reads, stale-while-revalidate)
4. ✅ **Portfolio + trading + FX UI** (atomic `execute_trade` RPC, valued holdings, dual-currency P&L, order history)
5. ✅ **Portfolio graph** (value-over-time chart, daily + per-trade snapshots, range filters)
6. ✅ **Research page + news** (`research-refresh` Edge Function, fundamentals + news cache)
7. ✅ **Search + watchlist** (`symbol-search` Edge Function + typeahead, star toggle, Watchlist tab with live prices)
8. ✅ **PWA polish** (offline banner, update-available prompt, offline deep-link fallback, route + vendor code-splitting)
