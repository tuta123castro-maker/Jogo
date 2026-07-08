# `market-refresh` Edge Function

The single trusted process that talks to EODHD. It runs with the Supabase
**service role**, so it can write the shared `price_cache` / `fx_cache` tables
that clients are only allowed to read. Clients call it (via
`supabase.functions.invoke('market-refresh', …)`) with the symbols and FX pairs
they need on screen; it fetches delayed quotes and rates from EODHD and upserts
them, skipping anything still within the 15-minute TTL so we stay inside the
free-tier rate limits.

## Contract

```jsonc
// request
{ "symbols": ["AAPL.US", "7203.T"], "pairs": ["JPYUSD"] }
// response
{ "prices": 2, "fx": 1, "skipped": 0 }
```

- `symbols` use EODHD's `TICKER.EXCHANGE` form. The listing currency is inferred
  from the exchange suffix (see `EXCHANGE_CURRENCY`), falling back to USD.
- `pairs` are concatenated ISO codes, e.g. `JPYUSD` (fetched as `JPYUSD.FOREX`).

## Secrets

Set these once — they are **server-side only** and never shipped to the client:

```bash
supabase secrets set EODHD_API_KEY=your_eodhd_key
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by the
# Supabase runtime; set them explicitly only for local `supabase functions serve`.
```

## Deploy

```bash
supabase functions deploy market-refresh
```

## Local run

```bash
supabase functions serve market-refresh --env-file supabase/functions/.env.local
```
