import { describe, expect, it } from 'vitest'
import { normalizeSymbol, parseSymbol } from './symbols'

describe('symbol normalization', () => {
  it('uppercases and keeps a known suffix', () => {
    expect(normalizeSymbol('aapl.us')).toBe('AAPL.US')
  })

  it('defaults a bare code to the US exchange', () => {
    expect(normalizeSymbol('tsla')).toBe('TSLA.US')
    expect(parseSymbol('tsla')).toEqual({ code: 'TSLA', exchange: 'US' })
  })

  it('zero-pads Hong Kong numeric codes to four digits', () => {
    expect(normalizeSymbol('700.hk')).toBe('0700.HK')
    expect(normalizeSymbol('9988.HK')).toBe('9988.HK')
  })

  it('preserves Nordic share-class dashes and repairs spaces', () => {
    expect(normalizeSymbol('ERIC-B.ST')).toBe('ERIC-B.ST')
    expect(normalizeSymbol('volv b.st')).toBe('VOLV-B.ST')
  })

  it('keeps a dotted code intact when the suffix is unknown', () => {
    // BRK.B is not an exchange suffix — treat the whole thing as a US code.
    expect(normalizeSymbol('brk.b')).toBe('BRK.B.US')
  })

  it('honours an explicit default exchange for bare codes', () => {
    expect(normalizeSymbol('galp', 'LS')).toBe('GALP.LS')
  })

  it('returns null for empty input', () => {
    expect(normalizeSymbol('   ')).toBeNull()
    expect(parseSymbol('')).toBeNull()
  })
})
