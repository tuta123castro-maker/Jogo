import Decimal from 'decimal.js'
import { currencyMeta, type HomeCurrency } from './currency'

/**
 * Money & FX foundation.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Financial math with JavaScript `number` (IEEE-754 float) silently loses
 * precision (0.1 + 0.2 !== 0.3). For a P&L engine that must be *exactly* right
 * across many trades and FX conversions, we do all arithmetic with decimal.js
 * (arbitrary-precision decimal) and only round at the display boundary.
 *
 * ── Representation ─────────────────────────────────────────────────────────
 * A `Money` is a high-precision Decimal amount tagged with an ISO currency
 * code. We persist amounts to the database as canonical decimal STRINGS
 * (never floats) so no precision is lost in transit.
 *
 * ── FX convention ──────────────────────────────────────────────────────────
 * An `FxRate` means: 1 unit of `from` currency = `rate` units of `to` currency.
 * So converting a native-currency amount into the home currency multiplies by
 * the (native → home) rate. Storing the rate used at trade time is what makes
 * exchange-rate moves genuinely affect returns.
 */

// Configure decimal.js: plenty of precision, round-half-up for display.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export type Numeric = Decimal | number | string

export interface Money {
  readonly amount: Decimal
  readonly currency: string
}

export interface FxRate {
  readonly from: string
  readonly to: string
  readonly rate: Decimal
}

export function dec(value: Numeric): Decimal {
  return value instanceof Decimal ? value : new Decimal(value)
}

export function money(amount: Numeric, currency: string): Money {
  return { amount: dec(amount), currency: currency.toUpperCase() }
}

export function zero(currency: string): Money {
  return money(0, currency)
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Currency mismatch: cannot combine ${a.currency} with ${b.currency}. ` +
        `Convert to a common currency first.`,
    )
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount.plus(b.amount), a.currency)
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount.minus(b.amount), a.currency)
}

/** Multiply a money amount by a scalar (e.g. quantity × unit price). */
export function scale(a: Money, factor: Numeric): Money {
  return money(a.amount.times(dec(factor)), a.currency)
}

export function negate(a: Money): Money {
  return money(a.amount.negated(), a.currency)
}

export function isNegative(a: Money): boolean {
  return a.amount.isNegative()
}

export function fxRate(from: string, to: string, rate: Numeric): FxRate {
  return { from: from.toUpperCase(), to: to.toUpperCase(), rate: dec(rate) }
}

/**
 * Convert a Money amount using an FxRate. The rate's `from` must match the
 * money's currency. A same-currency conversion (rate 1) is always allowed.
 */
export function convert(amount: Money, rate: FxRate): Money {
  if (amount.currency === rate.to) return amount
  if (amount.currency !== rate.from) {
    throw new Error(
      `FX rate ${rate.from}->${rate.to} cannot convert ${amount.currency}.`,
    )
  }
  return money(amount.amount.times(rate.rate), rate.to)
}

/** Round a money amount to its currency's conventional minor units. */
export function roundToCurrency(a: Money): Money {
  const { minorUnits } = currencyMeta(a.currency)
  return money(a.amount.toDecimalPlaces(minorUnits), a.currency)
}

// ── Persistence ────────────────────────────────────────────────────────────

/** Canonical, precision-preserving string for DB storage. */
export function toStorageString(a: Money): string {
  return a.amount.toFixed()
}

export function fromStorage(value: string, currency: string): Money {
  return money(value, currency)
}

// ── Display ──────────────────────────────────────────────────────────────

/**
 * Format a money value for display using the browser's Intl formatter,
 * respecting the currency's minor units.
 */
export function format(
  a: Money,
  opts: { locale?: string; withSymbol?: boolean } = {},
): string {
  const { locale = 'en-US', withSymbol = true } = opts
  const { minorUnits } = currencyMeta(a.currency)
  const rounded = a.amount.toDecimalPlaces(minorUnits).toNumber()
  try {
    return new Intl.NumberFormat(locale, {
      style: withSymbol ? 'currency' : 'decimal',
      currency: a.currency,
      minimumFractionDigits: minorUnits,
      maximumFractionDigits: minorUnits,
    }).format(rounded)
  } catch {
    // Unknown currency code for Intl — fall back to plain number + code.
    return `${rounded.toFixed(minorUnits)} ${a.currency}`
  }
}

/**
 * A price that appears in the UI: the SPEC requires the HOME-currency value
 * shown large/primary with the NATIVE-currency value small underneath. This
 * carries both so a `<PriceTag>` component can render them together.
 */
export interface DualCurrencyValue {
  home: Money
  native: Money
  /** True when native === home (no secondary line needed). */
  sameCurrency: boolean
}

export function dualValue(native: Money, homeRate: FxRate): DualCurrencyValue {
  const home = convert(native, homeRate)
  return {
    home,
    native,
    sameCurrency: home.currency === native.currency,
  }
}

export type { HomeCurrency }
