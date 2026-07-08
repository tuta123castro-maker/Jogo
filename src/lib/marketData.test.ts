import { describe, expect, it } from 'vitest'
import {
  CACHE_TTL_MS,
  fxPairKey,
  isStale,
  priceToMoney,
  requiredFxKeys,
  resolveFxRate,
  type FxRow,
} from './marketData'

const now = Date.UTC(2026, 0, 1, 12, 0, 0)
const iso = (msAgo: number) => new Date(now - msAgo).toISOString()

describe('cache staleness', () => {
  it('treats a fresh row as not stale', () => {
    expect(isStale(iso(CACHE_TTL_MS - 1000), now)).toBe(false)
  })

  it('treats a row older than the TTL as stale', () => {
    expect(isStale(iso(CACHE_TTL_MS + 1000), now)).toBe(true)
  })

  it('treats an unparseable timestamp as stale', () => {
    expect(isStale('not-a-date', now)).toBe(true)
  })
})

describe('fx pair keys', () => {
  it('builds a canonical uppercase key', () => {
    expect(fxPairKey('jpy', 'usd')).toBe('JPYUSD')
  })

  it('needs no keys for a same-currency conversion', () => {
    expect(requiredFxKeys('USD', 'USD')).toEqual([])
  })

  it('needs both direct and inverse keys otherwise', () => {
    expect(requiredFxKeys('JPY', 'USD')).toEqual(['JPYUSD', 'USDJPY'])
  })
})

describe('resolveFxRate', () => {
  const rows: FxRow[] = [
    { pair: 'JPYUSD', rate: '0.0064', fetched_at: iso(0) },
    { pair: 'EURUSD', rate: '1.08', fetched_at: iso(0) },
  ]

  it('returns rate 1 for identical currencies', () => {
    const r = resolveFxRate('USD', 'USD', rows)
    expect(r?.rate.toString()).toBe('1')
  })

  it('uses a direct pair as-is', () => {
    const r = resolveFxRate('JPY', 'USD', rows)
    expect(r?.from).toBe('JPY')
    expect(r?.to).toBe('USD')
    expect(r?.rate.toString()).toBe('0.0064')
  })

  it('reciprocates when only the inverse pair is cached', () => {
    const r = resolveFxRate('USD', 'EUR', rows)
    // 1 / 1.08 ≈ 0.9259
    expect(Number(r?.rate.toString())).toBeCloseTo(1 / 1.08, 8)
  })

  it('returns null when neither direction is cached', () => {
    expect(resolveFxRate('GBP', 'USD', rows)).toBeNull()
  })

  it('returns null for a zero inverse rate rather than dividing by zero', () => {
    const bad: FxRow[] = [{ pair: 'USDXXX', rate: '0', fetched_at: iso(0) }]
    expect(resolveFxRate('XXX', 'USD', bad)).toBeNull()
  })
})

describe('priceToMoney', () => {
  it('builds a Money from a cache row without float loss', () => {
    const m = priceToMoney({
      symbol: 'AAPL.US',
      price: '123.45',
      currency: 'USD',
      fetched_at: iso(0),
    })
    expect(m.currency).toBe('USD')
    expect(m.amount.toString()).toBe('123.45')
  })
})
