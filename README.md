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

### Rate-limit discipline (data layer — next phase)

Delayed prices and FX rates will be fetched by a trusted server process
(Supabase Edge Function, service role) into `price_cache` / `fx_cache`, so the
client reads cached rows and never polls EODHD per-render.

## Build order & status

1. ✅ **Scaffold + schema + money/FX foundation** (this commit)
2. ⬜ Auth + onboarding
3. ⬜ Data layer with caching
4. ⬜ Portfolio + trading + FX UI
5. ⬜ Portfolio graph
6. ⬜ Research page + news
7. ⬜ Search / watchlist / order history
8. ⬜ PWA polish
