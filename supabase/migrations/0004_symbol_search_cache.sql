-- ============================================================================
-- Open Markets v1 — symbol search cache
-- ============================================================================
-- Internal cache for the symbol-search Edge Function only. Unlike
-- price_cache/fx_cache/fundamentals_cache/news_cache, clients never read this
-- table directly — the function returns results straight in its response, the
-- same way any search-as-you-type endpoint would. RLS is enabled with NO
-- policies, so every client role is denied; only the service role (which
-- bypasses RLS) can touch it.
-- ============================================================================

create table public.symbol_search_cache (
  query      text primary key, -- normalized: trimmed, lowercased
  results    jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.symbol_search_cache enable row level security;
