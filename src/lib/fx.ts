/**
 * FX-pair enumeration for the home-currency conversion layer (SPEC-v2 STEP 2.2).
 *
 * Every tradeable asset's native currency must be convertible into each of the
 * four home currencies (USD/EUR/GBP/CNY) so the portfolio can show home-currency
 * value and the real FX effect. This module doesn't fetch rates — it enumerates
 * exactly WHICH native→home pairs the data layer must keep in `fx_cache`, so the
 * fetcher's job is fully derived from the universe and never hand-maintained.
 *
 * Pair keys match the `fx_cache.pair` format used in the schema (e.g. 'JPYUSD').
 */

import { HOME_CURRENCIES } from './currency'
import { universeCurrencies } from './markets'

/** Cache key for a native→home rate, matching `fx_cache.pair` (e.g. 'SEKUSD'). */
export function fxPairKey(from: string, to: string): string {
  return `${from.toUpperCase()}${to.toUpperCase()}`
}

/**
 * All native→home pairs needed to value `nativeCurrencies` in every currency of
 * `homeCurrencies`. Same-currency pairs (rate ≡ 1) are omitted — no fetch
 * needed. Result is sorted and deduped for stable output.
 */
export function requiredFxPairs(
  nativeCurrencies: readonly string[],
  homeCurrencies: readonly string[] = HOME_CURRENCIES,
): string[] {
  const pairs = new Set<string>()
  for (const native of nativeCurrencies) {
    for (const home of homeCurrencies) {
      if (native.toUpperCase() === home.toUpperCase()) continue
      pairs.add(fxPairKey(native, home))
    }
  }
  return [...pairs].sort()
}

/**
 * Every FX pair the whole tradeable universe requires against all four home
 * currencies — the authoritative fetch list for the FX cache warmer.
 */
export function universeFxPairs(): string[] {
  return requiredFxPairs(universeCurrencies())
}
