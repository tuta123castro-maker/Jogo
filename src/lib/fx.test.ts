import { describe, expect, it } from 'vitest'
import { fxPairKey, requiredFxPairs, universeFxPairs } from './fx'

describe('FX pair enumeration', () => {
  it('formats pair keys like the fx_cache schema', () => {
    expect(fxPairKey('sek', 'usd')).toBe('SEKUSD')
  })

  it('omits same-currency pairs', () => {
    const pairs = requiredFxPairs(['USD'], ['USD', 'EUR'])
    expect(pairs).toEqual(['USDEUR'])
    expect(pairs).not.toContain('USDUSD')
  })

  it('produces every native→home combination, deduped and sorted', () => {
    const pairs = requiredFxPairs(['SEK', 'SEK', 'NOK'], ['USD', 'EUR'])
    expect(pairs).toEqual(['NOKEUR', 'NOKUSD', 'SEKEUR', 'SEKUSD'])
  })

  it('covers the whole universe against the four home currencies', () => {
    const pairs = universeFxPairs()
    // New v2 currencies must each be convertible to USD.
    for (const cur of ['HKD', 'SAR', 'TRY', 'PLN', 'RON', 'NOK', 'SEK']) {
      expect(pairs).toContain(`${cur}USD`)
    }
    // No self-pairs leaked in.
    expect(pairs.every((p) => p.slice(0, 3) !== p.slice(3))).toBe(true)
  })
})
