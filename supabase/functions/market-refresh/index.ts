// Supabase Edge Function: market-refresh
// ---------------------------------------------------------------------------
// The ONLY place that talks to EODHD. Runs with the service role, so it can
// write the shared `price_cache` / `fx_cache` tables that clients may only
// read. Clients invoke this with the symbols/pairs they need; the function
// fetches delayed quotes + FX from EODHD and upserts them, skipping anything
// still fresh so we stay within the free-tier rate limits.
//
// Request body:  { "symbols": ["AAPL.US", "7203.T"], "pairs": ["JPYUSD"] }
// Response:      { "prices": <n written>, "fx": <n written>, "skipped": <n> }
//
// Required function secrets (set via `supabase secrets set …`):
//   EODHD_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ---------------------------------------------------------------------------

import { createClient } from 'jsr:@supabase/supabase-js@2'

const TTL_MS = 15 * 60 * 1000 // must match CACHE_TTL_MS on the client
const EODHD_BASE = 'https://eodhd.com/api/real-time'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Currency inferred from an EODHD symbol's exchange suffix (TICKER.EXCHANGE).
 * These listings quote in a single currency, so the suffix is authoritative and
 * saves a per-symbol fundamentals lookup. Unknown suffixes fall back to USD.
 */
const EXCHANGE_CURRENCY: Record<string, string> = {
  US: 'USD',
  LSE: 'GBP',
  L: 'GBP',
  PA: 'EUR',
  XETRA: 'EUR',
  F: 'EUR',
  AS: 'EUR',
  MC: 'EUR',
  MI: 'EUR',
  TO: 'CAD',
  V: 'CAD',
  T: 'JPY',
  KO: 'KRW',
  KQ: 'KRW',
  NSE: 'INR',
  BSE: 'INR',
  AU: 'AUD',
  SA: 'BRL',
  SW: 'CHF',
  HK: 'HKD',
  SS: 'CNY',
  SZ: 'CNY',
  CC: 'USD', // crypto quoted vs USD
  FOREX: 'USD',
}

function currencyForSymbol(symbol: string): string {
  const dot = symbol.lastIndexOf('.')
  if (dot === -1) return 'USD'
  const suffix = symbol.slice(dot + 1).toUpperCase()
  return EXCHANGE_CURRENCY[suffix] ?? 'USD'
}

interface EodQuote {
  close?: number | string
  previousClose?: number | string
}

async function fetchQuote(
  endpointSymbol: string,
  apiKey: string,
): Promise<number | null> {
  const url = `${EODHD_BASE}/${encodeURIComponent(
    endpointSymbol,
  )}?api_token=${apiKey}&fmt=json`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as EodQuote
  const raw = data.close ?? data.previousClose
  const value = typeof raw === 'string' ? Number(raw) : raw
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return null
  }
  return value
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const apiKey = Deno.env.get('EODHD_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!apiKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Function is not configured.' }, 500)
  }

  let body: { symbols?: string[]; pairs?: string[] }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const symbols = normalize(body.symbols)
  const pairs = normalize(body.pairs)
  const supabase = createClient(supabaseUrl, serviceKey)
  const cutoff = new Date(Date.now() - TTL_MS).toISOString()

  let skipped = 0
  let priceWrites = 0
  let fxWrites = 0

  // ── Prices ────────────────────────────────────────────────────────────────
  if (symbols.length > 0) {
    const { data: fresh } = await supabase
      .from('price_cache')
      .select('symbol')
      .in('symbol', symbols)
      .gte('fetched_at', cutoff)
    const freshSet = new Set((fresh ?? []).map((r) => r.symbol as string))

    const rows: {
      symbol: string
      price: string
      currency: string
      fetched_at: string
    }[] = []
    for (const symbol of symbols) {
      if (freshSet.has(symbol)) {
        skipped++
        continue
      }
      const price = await fetchQuote(symbol, apiKey)
      if (price === null) continue
      rows.push({
        symbol,
        price: String(price),
        currency: currencyForSymbol(symbol),
        fetched_at: new Date().toISOString(),
      })
    }
    if (rows.length > 0) {
      const { error } = await supabase
        .from('price_cache')
        .upsert(rows, { onConflict: 'symbol' })
      if (error) return json({ error: error.message }, 500)
      priceWrites = rows.length
    }
  }

  // ── FX ──────────────────────────────────────────────────────────────────
  if (pairs.length > 0) {
    const { data: fresh } = await supabase
      .from('fx_cache')
      .select('pair')
      .in('pair', pairs)
      .gte('fetched_at', cutoff)
    const freshSet = new Set((fresh ?? []).map((r) => r.pair as string))

    const rows: { pair: string; rate: string; fetched_at: string }[] = []
    for (const pair of pairs) {
      if (freshSet.has(pair)) {
        skipped++
        continue
      }
      // EODHD forex symbols are e.g. 'JPYUSD.FOREX'.
      const rate = await fetchQuote(`${pair}.FOREX`, apiKey)
      if (rate === null) continue
      rows.push({
        pair,
        rate: String(rate),
        fetched_at: new Date().toISOString(),
      })
    }
    if (rows.length > 0) {
      const { error } = await supabase
        .from('fx_cache')
        .upsert(rows, { onConflict: 'pair' })
      if (error) return json({ error: error.message }, 500)
      fxWrites = rows.length
    }
  }

  return json({ prices: priceWrites, fx: fxWrites, skipped }, 200)
})

function normalize(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [
    ...new Set(
      values
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim().toUpperCase())
        .filter(Boolean),
    ),
  ]
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
