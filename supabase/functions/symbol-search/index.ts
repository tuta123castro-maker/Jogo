// Supabase Edge Function: symbol-search
// ---------------------------------------------------------------------------
// The ONLY place that calls EODHD's ticker search. Unlike market-refresh and
// research-refresh, the client never reads the backing cache table directly —
// this behaves like any search-as-you-type endpoint, returning results
// straight in the response. The service-role cache just saves repeat EODHD
// calls for the same query across users/time, since the ~6-user pool tends to
// search the same handful of popular tickers.
//
// Request body:  { "query": "apple" }
// Response:      { "results": [{ "symbol": "AAPL.US", "name": "Apple Inc",
//                    "exchange": "US", "country": "USA", "currency": "USD",
//                    "type": "Common Stock" }, …] }
//
// Required function secrets (set via `supabase secrets set …`):
//   EODHD_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ---------------------------------------------------------------------------

import { createClient } from 'jsr:@supabase/supabase-js@2'

const TTL_MS = 7 * 24 * 60 * 60 * 1000 // ticker directories barely change
const RESULT_LIMIT = 15

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EodSearchItem {
  Code?: string
  Exchange?: string
  Name?: string
  Country?: string
  Currency?: string
  Type?: string
}

export interface SymbolResult {
  symbol: string
  name: string
  exchange: string
  country: string | null
  currency: string | null
  type: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('EODHD_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!apiKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Function is not configured.' }, 500)
  }

  let body: { query?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const normalized = (body.query ?? '').trim().toLowerCase()
  if (normalized.length < 2) return json({ results: [] }, 200)

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: cached } = await supabase
    .from('symbol_search_cache')
    .select('results, fetched_at')
    .eq('query', normalized)
    .maybeSingle()

  if (cached && !isStale(cached.fetched_at)) {
    return json({ results: cached.results }, 200)
  }

  const url = `https://eodhd.com/api/search/${encodeURIComponent(
    normalized,
  )}?api_token=${apiKey}&fmt=json&limit=${RESULT_LIMIT}`
  const res = await fetch(url)
  if (!res.ok) {
    // Serve stale cache rather than nothing if EODHD is unavailable.
    if (cached) return json({ results: cached.results }, 200)
    return json({ error: 'Search is temporarily unavailable.' }, 502)
  }

  const items = (await res.json()) as EodSearchItem[]
  const results: SymbolResult[] = items
    .filter((item): item is Required<Pick<EodSearchItem, 'Code' | 'Exchange'>> &
      EodSearchItem => Boolean(item.Code && item.Exchange))
    .map((item) => ({
      symbol: `${item.Code}.${item.Exchange}`.toUpperCase(),
      name: item.Name ?? item.Code!,
      exchange: item.Exchange!,
      country: item.Country ?? null,
      currency: item.Currency ?? null,
      type: item.Type ?? null,
    }))

  const { error } = await supabase.from('symbol_search_cache').upsert(
    { query: normalized, results, fetched_at: new Date().toISOString() },
    { onConflict: 'query' },
  )
  if (error) return json({ error: error.message }, 500)

  return json({ results }, 200)
})

function isStale(fetchedAt: string): boolean {
  const t = Date.parse(fetchedAt)
  if (Number.isNaN(t)) return true
  return Date.now() - t > TTL_MS
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
