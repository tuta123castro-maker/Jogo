-- ============================================================================
-- Open Markets v1 — initial schema
-- ============================================================================
-- Money values are stored as Postgres `numeric` (exact decimal, no float
-- rounding) to match the app's decimal.js math. The client serialises Money as
-- canonical decimal strings; Postgres `numeric` accepts and preserves them.
--
-- Every user-owned table has Row Level Security so each of the ~6 users can
-- only ever see and modify their own rows.
-- ============================================================================

-- Enums --------------------------------------------------------------------

create type home_currency as enum ('USD', 'EUR', 'GBP', 'CNY');
create type trade_side as enum ('buy', 'sell');

-- profiles (SPEC: `users`) --------------------------------------------------
-- One row per auth user, holding their chosen home currency.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  home_currency home_currency not null,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- portfolios ----------------------------------------------------------------
-- Cash balance, denominated in the user's home currency.

create table public.portfolios (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  cash          numeric not null default 0,
  cash_currency home_currency not null,
  created_at    timestamptz not null default now(),
  unique (user_id)
);

-- holdings ------------------------------------------------------------------
-- One row per (user, symbol). Cost basis is tracked BOTH in native currency
-- (avg_cost_native) and locked in home currency (cost_basis_home) so FX moves
-- genuinely affect P&L.

create table public.holdings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  symbol           text not null,
  quantity         numeric not null default 0,
  avg_cost_native  numeric not null default 0,
  native_currency  text not null,
  cost_basis_home  numeric not null default 0,
  home_currency    home_currency not null,
  updated_at       timestamptz not null default now(),
  unique (user_id, symbol)
);

-- trades --------------------------------------------------------------------
-- Immutable order history. `fx_rate` is native -> home at execution time.

create table public.trades (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  symbol           text not null,
  side             trade_side not null,
  quantity         numeric not null check (quantity > 0),
  price_native     numeric not null check (price_native >= 0),
  native_currency  text not null,
  fx_rate          numeric not null check (fx_rate > 0),
  home_currency    home_currency not null,
  executed_at      timestamptz not null default now()
);

create index trades_user_time_idx on public.trades (user_id, executed_at desc);

-- portfolio_snapshots -------------------------------------------------------
-- Daily (or per-event) total value in home currency, for the value-over-time
-- graph from the user's day one.

create table public.portfolio_snapshots (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  captured_at      timestamptz not null default now(),
  total_value_home numeric not null,
  home_currency    home_currency not null
);

create index snapshots_user_time_idx
  on public.portfolio_snapshots (user_id, captured_at);

-- watchlist -----------------------------------------------------------------

create table public.watchlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  symbol     text not null,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

-- price_cache ---------------------------------------------------------------
-- Shared, read-only-to-clients cache of delayed prices & FX rates. Populated
-- by a trusted server process (Supabase Edge Function using the service role),
-- so clients never hammer EODHD directly and the free-tier limits are safe.

create table public.price_cache (
  symbol     text primary key,
  price      numeric not null,
  currency   text not null,
  fetched_at timestamptz not null default now()
);

create table public.fx_cache (
  pair       text primary key,        -- e.g. 'JPYUSD'
  rate       numeric not null,
  fetched_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.portfolios          enable row level security;
alter table public.holdings            enable row level security;
alter table public.trades              enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.watchlist           enable row level security;
alter table public.price_cache         enable row level security;
alter table public.fx_cache            enable row level security;

-- Owner-only access for user tables.
create policy "own profile"    on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own portfolio"  on public.portfolios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own holdings"   on public.holdings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own trades"     on public.trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own snapshots"  on public.portfolio_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own watchlist"  on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Price/FX caches: any authenticated user may READ; writes are server-side
-- only (the service role bypasses RLS, so no write policy is granted here).
create policy "read prices" on public.price_cache
  for select using (auth.role() = 'authenticated');

create policy "read fx" on public.fx_cache
  for select using (auth.role() = 'authenticated');
