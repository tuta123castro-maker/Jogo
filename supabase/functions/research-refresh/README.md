# `research-refresh` Edge Function

The single trusted process that fetches EODHD **fundamentals** and **news**.
Runs with the Supabase **service role**, writing the shared
`fundamentals_cache` / `news_cache` tables that clients only read. Separate
from `market-refresh` because this data changes far less often than a live
quote, so it uses much longer TTLs: fundamentals for 24 hours, news for 1 hour.

## Contract

```jsonc
// request
{ "symbol": "AAPL.US" }
// response
{ "fundamentals": "fresh", "news": 6 }
```

`fundamentals` is `"fresh"` when the cache was outside its TTL and got
re-fetched, `"cached"` when the existing row was still within it. `news` is the
number of articles written this call (0 if the cache was still fresh).

## Secrets

```bash
supabase secrets set EODHD_API_KEY=your_eodhd_key
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically at
# runtime; set them explicitly only for local `supabase functions serve`.
```

## Deploy

```bash
supabase functions deploy research-refresh
```
