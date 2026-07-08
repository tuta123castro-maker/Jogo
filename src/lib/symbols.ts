/**
 * Ticker / exchange-suffix normalization (SPEC-v2 STEP 2.4).
 *
 * EODHD identifies an instrument as `CODE.EXCHANGE` (e.g. `AAPL.US`,
 * `0700.HK`, `ERIC-B.ST`). Users type symbols inconsistently — lower case,
 * missing leading zeros on Hong Kong codes, a space instead of a dash on Nordic
 * share classes, or no suffix at all. This module normalizes free-form input
 * into the canonical EODHD form so search and trading stay consistent across
 * every market. It is pure string handling — no network, no plan dependency.
 */

import { isKnownExchange } from './markets'

export interface ParsedSymbol {
  /** Instrument code, normalized (e.g. '0700', 'ERIC-B', 'AAPL'). */
  code: string
  /** EODHD exchange suffix (e.g. 'HK', 'ST', 'US'). */
  exchange: string
}

/** Exchange used when the user types a bare code with no suffix. */
export const DEFAULT_EXCHANGE = 'US'

/** Hong Kong instrument codes are numeric; EODHD zero-pads them to 4 digits. */
function normalizeCode(code: string, exchange: string): string {
  let c = code.trim().toUpperCase()
  if (exchange === 'HK' && /^\d+$/.test(c)) {
    c = c.padStart(4, '0')
  } else {
    // Nordic / European share classes use a dash: "ERIC B" → "ERIC-B".
    c = c.replace(/\s+/g, '-')
  }
  return c
}

/**
 * Parse free-form input into `{ code, exchange }`. The suffix after the LAST
 * dot is treated as the exchange when it's one we know; otherwise the whole
 * input is the code and `defaultExchange` applies (a dotted code with an
 * unknown suffix, e.g. `BRK.B`, is kept intact as the code). Returns `null`
 * for empty input.
 */
export function parseSymbol(
  input: string,
  defaultExchange: string = DEFAULT_EXCHANGE,
): ParsedSymbol | null {
  const raw = input.trim()
  if (!raw) return null

  const lastDot = raw.lastIndexOf('.')
  if (lastDot > 0 && lastDot < raw.length - 1) {
    const maybeExchange = raw.slice(lastDot + 1).toUpperCase()
    if (isKnownExchange(maybeExchange)) {
      const exchange = maybeExchange
      return { exchange, code: normalizeCode(raw.slice(0, lastDot), exchange) }
    }
  }

  const exchange = defaultExchange.toUpperCase()
  return { exchange, code: normalizeCode(raw, exchange) }
}

/** Canonical `CODE.EXCHANGE` string, or `null` if the input can't be parsed. */
export function normalizeSymbol(
  input: string,
  defaultExchange: string = DEFAULT_EXCHANGE,
): string | null {
  const parsed = parseSymbol(input, defaultExchange)
  return parsed ? `${parsed.code}.${parsed.exchange}` : null
}
