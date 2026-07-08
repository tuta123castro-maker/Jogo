import type { SupabaseClient } from '@supabase/supabase-js'
import type { HomeCurrency } from './currency'

/**
 * Trade execution — a thin client over the atomic `execute_trade` Postgres
 * function. All the money math, invariants (sufficient cash / shares), and the
 * three-table update happen server-side in one transaction, so the client just
 * sends the order and surfaces any error.
 */

export type TradeSide = 'buy' | 'sell'

export interface TradeParams {
  symbol: string
  side: TradeSide
  quantity: string | number
  /** Price per unit in the asset's native currency. */
  priceNative: string | number
  nativeCurrency: string
  /** Native → home FX rate used to settle this trade. */
  fxRate: string | number
  homeCurrency: HomeCurrency
}

export interface TradeRecord {
  id: string
  symbol: string
  side: TradeSide
  quantity: string
  price_native: string
  native_currency: string
  fx_rate: string
  home_currency: HomeCurrency
  executed_at: string
}

export async function executeTrade(
  supabase: SupabaseClient,
  params: TradeParams,
): Promise<TradeRecord> {
  const { data, error } = await supabase.rpc('execute_trade', {
    p_symbol: params.symbol.trim().toUpperCase(),
    p_side: params.side,
    p_quantity: String(params.quantity),
    p_price_native: String(params.priceNative),
    p_native_currency: params.nativeCurrency.trim().toUpperCase(),
    p_fx_rate: String(params.fxRate),
    p_home_currency: params.homeCurrency,
  })

  if (error) throw new Error(friendlyError(error.message))
  return data as TradeRecord
}

/** Load the most recent trades for the order-history view. */
export async function loadTrades(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<TradeRecord[]> {
  const { data, error } = await supabase
    .from('trades')
    .select(
      'id, symbol, side, quantity, price_native, native_currency, fx_rate, home_currency, executed_at',
    )
    .eq('user_id', userId)
    .order('executed_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as TradeRecord[]
}

/** Map raw Postgres exception text to a friendlier message for the UI. */
function friendlyError(message: string): string {
  if (message.includes('Insufficient cash')) {
    return 'Not enough cash for this order.'
  }
  if (message.includes('Insufficient shares')) {
    return 'You don’t hold enough shares to sell that many.'
  }
  if (message.includes('No portfolio')) {
    return 'Your portfolio isn’t set up yet.'
  }
  return message
}
