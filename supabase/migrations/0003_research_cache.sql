-- ============================================================================
-- Open Markets v1 — research data (fundamentals + news) cache
-- ============================================================================
-- Same shape as price_cache / fx_cache (0001_init.sql): a trusted server
-- process (the research-refresh Edge Function, service role) is the only
-- writer; clients only ever read. Fundamentals and news change far less often
-- than a live quote, so each has its own longer TTL enforced by the function,
-- not by these tables.
-- ============================================================================

create table public.fundamentals_cache (
  symbol       text primary key,
  name         text,
  sector       text,
  industry     text,
  description  text,
  currency     text,
  market_cap   numeric,
  pe_ratio     numeric,
  fetched_at   timestamptz not null default now()
);

create table public.news_cache (
  id           uuid primary key default gen_random_uuid(),
  symbol       text not null,
  headline     text not null,
  url          text not null,
  source       text,
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),
  unique (symbol, url)
);

create index news_cache_symbol_published_idx
  on public.news_cache (symbol, published_at desc);

alter table public.fundamentals_cache enable row level security;
alter table public.news_cache         enable row level security;

-- Read-only to clients; writes are server-side only (service role bypasses RLS).
create policy "read fundamentals" on public.fundamentals_cache
  for select using (auth.role() = 'authenticated');

create policy "read news" on public.news_cache
  for select using (auth.role() = 'authenticated');
