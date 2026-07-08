import { add, zero, type FxRate, type Money } from './money'
import { valuePosition, type Position, type Valuation } from './portfolio'

/**
 * Portfolio aggregation: value each position at its current cached price and FX
 * rate, then roll positions + cash up into portfolio totals. Pure and
 * synchronous — the hook supplies the price/FX lookups from the cache.
 *
 * A position with no cached quote or FX rate yet is carried with a null
 * valuation and left OUT of the totals, so the summary never shows a wrong
 * number just because data hasn't loaded.
 */

export interface ValuedPosition {
  position: Position
  /** Current native price per unit, or null if not cached yet. */
  priceNative: Money | null
  valuation: Valuation | null
}

export interface PortfolioSummary {
  cash: Money
  /** Sum of market value (home currency) across positions that could be valued. */
  holdingsValueHome: Money
  /** cash + holdingsValueHome. */
  totalValueHome: Money
  /** Sum of unrealized P&L (home currency) across valued positions. */
  unrealizedHome: Money
  positions: ValuedPosition[]
  /** True when at least one position lacks a price/FX rate. */
  hasPending: boolean
}

export interface SummaryInputs {
  cash: Money
  positions: Position[]
  /** Current native-currency price for a symbol, or null if uncached. */
  priceOf: (symbol: string) => Money | null
  /** Current native→home FX rate, or null if uncached. */
  fxOf: (fromCurrency: string, toCurrency: string) => FxRate | null
}

export function summarizePortfolio({
  cash,
  positions,
  priceOf,
  fxOf,
}: SummaryInputs): PortfolioSummary {
  const home = cash.currency
  let holdingsValueHome = zero(home)
  let unrealizedHome = zero(home)
  let hasPending = false

  const valued: ValuedPosition[] = positions.map((position) => {
    const priceNative = priceOf(position.symbol)
    const fx = fxOf(position.nativeCurrency, home)

    if (!priceNative || !fx) {
      hasPending = true
      return { position, priceNative: priceNative ?? null, valuation: null }
    }

    const valuation = valuePosition(position, priceNative.amount, fx)
    holdingsValueHome = add(holdingsValueHome, valuation.marketValueHome)
    unrealizedHome = add(unrealizedHome, valuation.unrealizedHome)
    return { position, priceNative, valuation }
  })

  return {
    cash,
    holdingsValueHome,
    totalValueHome: add(cash, holdingsValueHome),
    unrealizedHome,
    positions: valued,
    hasPending,
  }
}
