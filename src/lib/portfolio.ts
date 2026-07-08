import Decimal from 'decimal.js'
import {
  add,
  convert,
  dec,
  fxRate,
  money,
  scale,
  subtract,
  zero,
  type FxRate,
  type Money,
  type Numeric,
} from './money'

/**
 * Position & P&L engine — the part that makes the FX effect *real*.
 *
 * The key design decision: a position's cost basis is locked in the user's
 * HOME currency at the moment of each trade (using that trade's FX rate).
 * Market value, by contrast, is computed with the CURRENT FX rate. Because the
 * two use different exchange rates, a holding can rise in its native currency
 * yet still lose money in the home currency (and vice-versa) — exactly the
 * behaviour the SPEC asks for.
 */

export interface Position {
  symbol: string
  /** Native (listing) currency of the asset, e.g. 'JPY' for a Tokyo listing. */
  nativeCurrency: string
  /** User's home currency, e.g. 'USD'. */
  homeCurrency: string
  /** Units held (fractional allowed for crypto). */
  quantity: Decimal
  /** Weighted-average purchase price per unit, in the native currency. */
  avgCostNative: Decimal
  /** Total amount paid, in the HOME currency, at the historical FX of each buy. */
  costBasisHome: Money
}

export function emptyPosition(
  symbol: string,
  nativeCurrency: string,
  homeCurrency: string,
): Position {
  return {
    symbol,
    nativeCurrency: nativeCurrency.toUpperCase(),
    homeCurrency: homeCurrency.toUpperCase(),
    quantity: dec(0),
    avgCostNative: dec(0),
    costBasisHome: zero(homeCurrency),
  }
}

/**
 * Apply a BUY: add units at `priceNative` per unit, converting the spend into
 * home currency at the trade's FX rate and accumulating it into the home cost
 * basis. Native average cost is updated as a quantity-weighted average.
 */
export function applyBuy(
  pos: Position,
  qty: Numeric,
  priceNative: Numeric,
  fxNativeToHome: FxRate,
): Position {
  const q = dec(qty)
  const price = dec(priceNative)
  const spendNative = money(q.times(price), pos.nativeCurrency)
  const spendHome = convert(spendNative, fxNativeToHome)

  const newQty = pos.quantity.plus(q)
  const newAvgNative = newQty.isZero()
    ? dec(0)
    : pos.quantity
        .times(pos.avgCostNative)
        .plus(q.times(price))
        .div(newQty)

  return {
    ...pos,
    quantity: newQty,
    avgCostNative: newAvgNative,
    costBasisHome: add(pos.costBasisHome, spendHome),
  }
}

export interface SellResult {
  position: Position
  /** Proceeds of the sale in home currency at the sale's FX rate. */
  proceedsHome: Money
  /** Realized P&L in home currency (proceeds − home cost basis of units sold). */
  realizedHome: Money
}

/**
 * Apply a SELL: remove units, realize P&L in home currency. The cost basis of
 * the units sold is removed proportionally from the home cost basis.
 */
export function applySell(
  pos: Position,
  qty: Numeric,
  priceNative: Numeric,
  fxNativeToHome: FxRate,
): SellResult {
  const q = dec(qty)
  if (q.greaterThan(pos.quantity)) {
    throw new Error(
      `Cannot sell ${q} units of ${pos.symbol}; only ${pos.quantity} held.`,
    )
  }

  const proceedsNative = money(q.times(dec(priceNative)), pos.nativeCurrency)
  const proceedsHome = convert(proceedsNative, fxNativeToHome)

  const fraction = pos.quantity.isZero() ? dec(0) : q.div(pos.quantity)
  const basisRemovedHome = scale(pos.costBasisHome, fraction)
  const realizedHome = subtract(proceedsHome, basisRemovedHome)

  const newQty = pos.quantity.minus(q)
  return {
    position: {
      ...pos,
      quantity: newQty,
      avgCostNative: newQty.isZero() ? dec(0) : pos.avgCostNative,
      costBasisHome: subtract(pos.costBasisHome, basisRemovedHome),
    },
    proceedsHome,
    realizedHome,
  }
}

export interface Valuation {
  marketValueNative: Money
  marketValueHome: Money
  /** Unrealized P&L in home currency: market value (current FX) − home cost basis. */
  unrealizedHome: Money
  /** P&L expressed purely in native currency, ignoring FX (for comparison). */
  unrealizedNative: Money
}

/**
 * Value a position at the current native price and current FX rate.
 * `marketValueHome` uses the CURRENT rate while `costBasisHome` was locked at
 * historical rates — the gap between them is the realized FX effect.
 */
export function valuePosition(
  pos: Position,
  currentPriceNative: Numeric,
  currentFxNativeToHome: FxRate,
): Valuation {
  const price = dec(currentPriceNative)
  const marketValueNative = money(pos.quantity.times(price), pos.nativeCurrency)
  const marketValueHome = convert(marketValueNative, currentFxNativeToHome)

  const costNative = money(
    pos.quantity.times(pos.avgCostNative),
    pos.nativeCurrency,
  )

  return {
    marketValueNative,
    marketValueHome,
    unrealizedHome: subtract(marketValueHome, pos.costBasisHome),
    unrealizedNative: subtract(marketValueNative, costNative),
  }
}

/** Identity FX rate (used when native currency already equals home currency). */
export function identityFx(currency: string): FxRate {
  return fxRate(currency, currency, 1)
}
