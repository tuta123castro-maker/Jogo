import type { SupabaseClient } from '@supabase/supabase-js'
import { dec, money, type Money } from './money'
import { emptyPosition, type Position } from './portfolio'
import type { HomeCurrency } from './currency'

/**
 * Reads that turn stored rows into the engine's `Position` values and the
 * portfolio's cash `Money`. Valuation (current price × current FX) is layered
 * on top in `portfolioSummary.ts` using the market-data cache.
 */

export interface HoldingRow {
  symbol: string
  quantity: string
  avg_cost_native: string
  native_currency: string
  cost_basis_home: string
  home_currency: HomeCurrency
}

export function rowToPosition(row: HoldingRow): Position {
  const base = emptyPosition(row.symbol, row.native_currency, row.home_currency)
  return {
    ...base,
    quantity: dec(row.quantity),
    avgCostNative: dec(row.avg_cost_native),
    costBasisHome: money(row.cost_basis_home, row.home_currency),
  }
}

export async function loadHoldings(
  supabase: SupabaseClient,
  userId: string,
): Promise<Position[]> {
  const { data, error } = await supabase
    .from('holdings')
    .select(
      'symbol, quantity, avg_cost_native, native_currency, cost_basis_home, home_currency',
    )
    .eq('user_id', userId)
    .order('symbol')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) =>
    rowToPosition({
      symbol: String(r.symbol),
      quantity: String(r.quantity),
      avg_cost_native: String(r.avg_cost_native),
      native_currency: String(r.native_currency),
      cost_basis_home: String(r.cost_basis_home),
      home_currency: r.home_currency as HomeCurrency,
    }),
  )
}

export interface PortfolioCash {
  cash: Money
  currency: HomeCurrency
}

export async function loadCash(
  supabase: SupabaseClient,
  userId: string,
): Promise<PortfolioCash | null> {
  const { data, error } = await supabase
    .from('portfolios')
    .select('cash, cash_currency')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const currency = data.cash_currency as HomeCurrency
  return { cash: money(String(data.cash), currency), currency }
}
