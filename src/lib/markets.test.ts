import { describe, expect, it } from 'vitest'
import {
  DEFERRED_EXCHANGES,
  EXCHANGES,
  dataQualityLabel,
  exchangeByCode,
  isKnownExchange,
  universeCurrencies,
} from './markets'
import { exchangeStatus } from './exchange-hours'
import { currencyMeta } from './currency'

describe('market universe', () => {
  it('has unique exchange codes', () => {
    const codes = EXCHANGES.map((e) => e.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('every native currency is known to the currency registry', () => {
    for (const currency of universeCurrencies()) {
      // currencyMeta always returns something; assert it is a real entry, not
      // the 2-dp fallback that echoes the code back as its own symbol.
      const meta = currencyMeta(currency)
      expect(meta.symbol === currency && currency.length === 3).toBe(false)
    }
  })

  it('marks non-US exchanges as EOD-only and paid-tier', () => {
    const hk = exchangeByCode('hk')!
    expect(hk.dataQuality).toBe('eod')
    expect(hk.requiresPaidTier).toBe(true)
    const us = exchangeByCode('US')!
    expect(us.dataQuality).toBe('delayed')
    expect(us.requiresPaidTier).toBe(false)
  })

  it('defers Russia — MOEX is not in the tradeable universe', () => {
    expect(isKnownExchange('MCX')).toBe(false)
    expect(DEFERRED_EXCHANGES.some((e) => e.code === 'MCX')).toBe(true)
  })

  it('labels data quality for the UI', () => {
    expect(dataQualityLabel('eod')).toMatch(/end-of-day/i)
    expect(dataQualityLabel('delayed')).toMatch(/delayed/i)
  })
})

describe('exchange open/closed status', () => {
  const at = (iso: string) => new Date(iso)

  it('US open at midday NY on a weekday', () => {
    // 2026-07-08 is a Wednesday; 14:00Z = 10:00 America/New_York (EDT).
    const status = exchangeStatus(exchangeByCode('US')!, at('2026-07-08T14:00:00Z'))
    expect(status.isOpen).toBe(true)
    expect(status.state).toBe('open')
  })

  it('US closed on a public holiday', () => {
    // Independence Day observed 2026-07-03.
    const status = exchangeStatus(exchangeByCode('US')!, at('2026-07-03T15:00:00Z'))
    expect(status.state).toBe('holiday')
    expect(status.isOpen).toBe(false)
  })

  it('HK is closed during its lunch break', () => {
    // 04:30Z = 12:30 Asia/Hong_Kong → inside the 12:00–13:00 lunch break.
    const status = exchangeStatus(exchangeByCode('HK')!, at('2026-07-08T04:30:00Z'))
    expect(status.state).toBe('closed')
    expect(status.isOpen).toBe(false)
  })

  it('HK is open in the morning session', () => {
    // 02:00Z = 10:00 Asia/Hong_Kong → inside the morning session.
    const status = exchangeStatus(exchangeByCode('HK')!, at('2026-07-08T02:00:00Z'))
    expect(status.isOpen).toBe(true)
  })

  it('Tadawul trades Sunday but rests Friday', () => {
    const tadawul = exchangeByCode('SR')!
    // 2026-07-05 is a Sunday, 09:00Z = 12:00 Asia/Riyadh → open.
    expect(exchangeStatus(tadawul, at('2026-07-05T09:00:00Z')).isOpen).toBe(true)
    // 2026-07-10 is a Friday → weekend for Tadawul.
    expect(exchangeStatus(tadawul, at('2026-07-10T09:00:00Z')).state).toBe('weekend')
  })
})
