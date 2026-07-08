// Supabase Edge Function: research-refresh
// ---------------------------------------------------------------------------
// The ONLY place that fetches EODHD fundamentals + news. Runs with the service
// role, so it can write the shared `fundamentals_cache` / `news_cache` tables
// that clients may only read. A client asks for one symbol; the function
// fetches whatever is stale (or missing) and upserts it. Fundamentals and news
// change far less than a live quote, so the TTLs here are much longer than
// market-refresh's 15 minutes.
//
// Request body:  { "symbol": "AAPL.US" }
// Response:      { "fundamentals": "fresh" | "cached", "news": <n written> }
//
// Required function secrets (set via `supabase secrets set …`):
//   EODHD_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ---------------------------------------------------------------------------

import { createClient } from 'jsr:@supabase/supabase-js@2'

const FUNDAMENTALS_TTL_MS = 24 * 60 * 60 * 1000 // 1 day
const NEWS_TTL_MS = 60 * 60 * 1000 // 1 hour
const NEWS_LIMIT = 10

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EodFundamentals {
  General?: {
    Name?: string
    Sector?: string
    Industry?: string
    Description?: string
    CurrencyCode?: string
  }
  Highlights?: {
    MarketCapitalization?: number | string
    PERatio?: number | string
  }
}

interface EodNewsItem {
  date?: string
  title?: string
  link?: string
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

  let body: { symbol?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const symbol = body.symbol?.trim().toUpperCase()
  if (!symbol) return json({ error: 'symbol is required.' }, 400)

  const supabase = createClient(supabaseUrl, serviceKey)
  let fundamentalsResult: 'fresh' | 'cached' = 'cached'
  let newsWritten = 0

  // ── Fundamentals ────────────────────────────────────────────────────────
  const { data: existingFund } = await supabase
    .from('fundamentals_cache')
    .select('fetched_at')
    .eq('symbol', symbol)
    .maybeSingle()

  if (!existingFund || isStale(existingFund.fetched_at, FUNDAMENTALS_TTL_MS)) {
    const url = `https://eodhd.com/api/fundamentals/${encodeURIComponent(
      symbol,
    )}?api_token=${apiKey}&fmt=json`
    const res = await fetch(url)
    if (res.ok) {
      const data = (await res.json()) as EodFundamentals
      const { error } = await supabase.from('fundamentals_cache').upsert(
        {
          symbol,
          name: data.General?.Name ?? null,
          sector: data.General?.Sector ?? null,
          industry: data.General?.Industry ?? null,
          description: data.General?.Description ?? null,
          currency: data.General?.CurrencyCode ?? null,
          market_cap: toNumericOrNull(data.Highlights?.MarketCapitalization),
          pe_ratio: toNumericOrNull(data.Highlights?.PERatio),
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'symbol' },
      )
      if (error) return json({ error: error.message }, 500)
      fundamentalsResult = 'fresh'
    }
  }

  // ── News ────────────────────────────────────────────────────────────────
  const { data: latestNews } = await supabase
    .from('news_cache')
    .select('fetched_at')
    .eq('symbol', symbol)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestNews || isStale(latestNews.fetched_at, NEWS_TTL_MS)) {
    const url = `https://eodhd.com/api/news?s=${encodeURIComponent(
      symbol,
    )}&limit=${NEWS_LIMIT}&api_token=${apiKey}&fmt=json`
    const res = await fetch(url)
    if (res.ok) {
      const items = (await res.json()) as EodNewsItem[]
      const rows = items
        .filter((item): item is Required<Pick<EodNewsItem, 'title' | 'link'>> =>
          Boolean(item.title && item.link),
        )
        .map((item) => ({
          symbol,
          headline: item.title,
          url: item.link,
          source: hostnameOf(item.link),
          published_at: item.date ? new Date(item.date).toISOString() : null,
          fetched_at: new Date().toISOString(),
        }))
      if (rows.length > 0) {
        const { error } = await supabase
          .from('news_cache')
          .upsert(rows, { onConflict: 'symbol,url' })
        if (error) return json({ error: error.message }, 500)
        newsWritten = rows.length
      }
    }
  }

  return json({ fundamentals: fundamentalsResult, news: newsWritten }, 200)
})

function isStale(fetchedAt: string, ttlMs: number): boolean {
  const t = Date.parse(fetchedAt)
  if (Number.isNaN(t)) return true
  return Date.now() - t > ttlMs
}

function toNumericOrNull(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
