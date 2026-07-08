# `symbol-search` Edge Function

The only process that calls EODHD's ticker search. Unlike `market-refresh` and
`research-refresh`, the client never reads the backing cache table directly —
this behaves like a normal search-as-you-type endpoint and returns results
straight in the response body.

## Contract

```jsonc
// request
{ "query": "apple" }
// response
{ "results": [
  { "symbol": "AAPL.US", "name": "Apple Inc", "exchange": "US",
    "country": "USA", "currency": "USD", "type": "Common Stock" }
] }
```

Queries under 2 characters return `{ "results": [] }` without calling EODHD.
Results are cached by normalized query (trimmed, lowercased) for 7 days —
ticker directories barely change — so repeat searches for the same term across
the small user pool don't re-hit EODHD. If EODHD is unavailable, a stale cache
entry is served rather than an error.

## Secrets

```bash
supabase secrets set EODHD_API_KEY=your_eodhd_key
```

## Deploy

```bash
supabase functions deploy symbol-search
```
