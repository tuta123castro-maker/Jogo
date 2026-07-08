/**
 * Currency registry.
 *
 * `homeCurrencies` are the four currencies a user may pick as their home
 * currency in onboarding (per SPEC). `minorUnits` is the number of decimal
 * places the currency is conventionally displayed with — used ONLY for
 * display rounding, never for internal math (internal math stays high-precision
 * via Decimal, see money.ts).
 */

export const HOME_CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY'] as const
export type HomeCurrency = (typeof HOME_CURRENCIES)[number]

/**
 * Native currencies we expect to encounter from the supported exchanges
 * (US, Canada, major Europe, Japan, Korea, India, Australia, Brazil) plus
 * crypto quote currency. This list is display metadata; unknown currencies
 * fall back to 2 minor units.
 */
export interface CurrencyMeta {
  code: string
  symbol: string
  minorUnits: number
}

const REGISTRY: Record<string, CurrencyMeta> = {
  USD: { code: 'USD', symbol: '$', minorUnits: 2 },
  EUR: { code: 'EUR', symbol: '€', minorUnits: 2 },
  GBP: { code: 'GBP', symbol: '£', minorUnits: 2 },
  CNY: { code: 'CNY', symbol: '¥', minorUnits: 2 },
  CAD: { code: 'CAD', symbol: 'CA$', minorUnits: 2 },
  JPY: { code: 'JPY', symbol: '¥', minorUnits: 0 },
  KRW: { code: 'KRW', symbol: '₩', minorUnits: 0 },
  INR: { code: 'INR', symbol: '₹', minorUnits: 2 },
  AUD: { code: 'AUD', symbol: 'A$', minorUnits: 2 },
  BRL: { code: 'BRL', symbol: 'R$', minorUnits: 2 },
  CHF: { code: 'CHF', symbol: 'CHF', minorUnits: 2 },
  HKD: { code: 'HKD', symbol: 'HK$', minorUnits: 2 },
}

const FALLBACK_MINOR_UNITS = 2

export function currencyMeta(code: string): CurrencyMeta {
  return (
    REGISTRY[code.toUpperCase()] ?? {
      code: code.toUpperCase(),
      symbol: code.toUpperCase(),
      minorUnits: FALLBACK_MINOR_UNITS,
    }
  )
}

export function isHomeCurrency(code: string): code is HomeCurrency {
  return (HOME_CURRENCIES as readonly string[]).includes(code.toUpperCase())
}
