-- ============================================================================
-- Open Markets v1 — atomic trade execution
-- ============================================================================
-- A trade touches three tables (holdings, portfolios.cash, trades). Doing that
-- from the client in separate writes risks a partial update that corrupts the
-- books. `execute_trade` performs the whole thing in one transaction with the
-- money math in Postgres `numeric` (exact decimal, same guarantee as the app's
-- decimal.js), plus server-side guards for cash and share sufficiency.
--
-- Runs SECURITY INVOKER, so Row Level Security still applies and every row is
-- scoped to auth.uid() — a user can only ever trade their own portfolio.
-- ============================================================================

create or replace function public.execute_trade(
  p_symbol          text,
  p_side            public.trade_side,
  p_quantity        numeric,
  p_price_native    numeric,
  p_native_currency text,
  p_fx_rate         numeric,
  p_home_currency   public.home_currency
) returns public.trades
language plpgsql
security invoker
as $$
declare
  v_user          uuid := auth.uid();
  v_portfolio     public.portfolios;
  v_holding       public.holdings;
  v_found         boolean;
  v_spend         numeric;
  v_proceeds      numeric;
  v_fraction      numeric;
  v_basis_removed numeric;
  v_new_qty       numeric;
  v_new_avg       numeric;
  v_trade         public.trades;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;
  if p_price_native < 0 then
    raise exception 'Price must be non-negative';
  end if;
  if p_fx_rate <= 0 then
    raise exception 'FX rate must be positive';
  end if;

  select * into v_portfolio
    from public.portfolios
   where user_id = v_user
     for update;
  if not found then
    raise exception 'No portfolio found — finish onboarding first';
  end if;
  if v_portfolio.cash_currency <> p_home_currency then
    raise exception 'Home currency mismatch with portfolio';
  end if;

  select * into v_holding
    from public.holdings
   where user_id = v_user and symbol = p_symbol
     for update;
  v_found := found;

  if p_side = 'buy' then
    v_spend := round(p_quantity * p_price_native * p_fx_rate, 10);
    if v_spend > v_portfolio.cash then
      raise exception 'Insufficient cash: need %, have %', v_spend, v_portfolio.cash;
    end if;

    if v_found then
      v_new_qty := v_holding.quantity + p_quantity;
      v_new_avg := round(
        (v_holding.quantity * v_holding.avg_cost_native
          + p_quantity * p_price_native) / v_new_qty, 10);
      update public.holdings set
        quantity        = v_new_qty,
        avg_cost_native = v_new_avg,
        cost_basis_home = v_holding.cost_basis_home + v_spend,
        updated_at      = now()
      where id = v_holding.id;
    else
      insert into public.holdings(
        user_id, symbol, quantity, avg_cost_native, native_currency,
        cost_basis_home, home_currency)
      values (
        v_user, p_symbol, p_quantity, p_price_native, p_native_currency,
        v_spend, p_home_currency);
    end if;

    update public.portfolios
       set cash = cash - v_spend
     where id = v_portfolio.id;

  else -- sell
    if not v_found or v_holding.quantity < p_quantity then
      raise exception 'Insufficient shares: holding % of %',
        coalesce(v_holding.quantity, 0), p_symbol;
    end if;

    v_proceeds      := round(p_quantity * p_price_native * p_fx_rate, 10);
    v_fraction      := p_quantity / v_holding.quantity;
    v_basis_removed := round(v_holding.cost_basis_home * v_fraction, 10);
    v_new_qty       := v_holding.quantity - p_quantity;

    if v_new_qty = 0 then
      delete from public.holdings where id = v_holding.id;
    else
      update public.holdings set
        quantity        = v_new_qty,
        cost_basis_home = v_holding.cost_basis_home - v_basis_removed,
        updated_at      = now()
      where id = v_holding.id;
    end if;

    update public.portfolios
       set cash = cash + v_proceeds
     where id = v_portfolio.id;
  end if;

  insert into public.trades(
    user_id, symbol, side, quantity, price_native, native_currency,
    fx_rate, home_currency)
  values (
    v_user, p_symbol, p_side, p_quantity, p_price_native, p_native_currency,
    p_fx_rate, p_home_currency)
  returning * into v_trade;

  return v_trade;
end;
$$;

grant execute on function public.execute_trade(
  text, public.trade_side, numeric, numeric, text, numeric, public.home_currency
) to authenticated;
