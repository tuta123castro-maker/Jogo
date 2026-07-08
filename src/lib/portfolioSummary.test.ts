import { describe, expect, it } from 'vitest'
import { fxRate, money, type FxRate, type Money } from './money'
import { applyBuy, emptyPosition, identityFx, type Position } from './portfolio'
import { summarizePortfolio } from './portfolioSummary'

// A USD-home portfolio holding a Tokyo (JPY) stock and a US stock.
function jpyPosition(): Position {
  // Buy 100 units @ ¥1,000 when JPY→USD was 0.01 (so cost basis = $1,000).
  return applyBuy(
    emptyPosition('7203.T', 'JPY', 'USD'),
    100,
    1000,
    fxRate('JPY', 'USD', 0.01),
  )
}

function usdPosition(): Position {
  // Buy 10 units @ $100 (home == native, identity FX). Cost basis = $1,000.
  return applyBuy(
    emptyPosition('AAPL.US', 'USD', 'USD'),
    10,
    100,
    identityFx('USD'),
  )
}

describe('summarizePortfolio', () => {
  const prices: Record<string, Money> = {
    '7203.T': money(1000, 'JPY'), // unchanged in native terms
    'AAPL.US': money(120, 'USD'), // up 20%
  }
  const fx: Record<string, FxRate> = {
    'JPY>USD': fxRate('JPY', 'USD', 0.009), // yen weakened vs the 0.01 at purchase
    'USD>USD': identityFx('USD'),
  }
  const inputs = {
    cash: money(5000, 'USD'),
    positions: [jpyPosition(), usdPosition()],
    priceOf: (s: string) => prices[s] ?? null,
    fxOf: (from: string, to: string) => fx[`${from}>${to}`] ?? null,
  }

  it('captures the FX effect: flat in yen but a loss in USD', () => {
    const s = summarizePortfolio(inputs)
    const jpy = s.positions.find((p) => p.position.symbol === '7203.T')!
    // Native value flat (¥100,000 → $900 at 0.009 vs $1,000 basis) => -$100.
    expect(jpy.valuation?.marketValueHome.amount.toString()).toBe('900')
    expect(jpy.valuation?.unrealizedHome.amount.toString()).toBe('-100')
    // In native terms there is no gain or loss.
    expect(jpy.valuation?.unrealizedNative.amount.toString()).toBe('0')
  })

  it('rolls positions + cash into totals', () => {
    const s = summarizePortfolio(inputs)
    // holdings home value = $900 (JPY) + $1,200 (AAPL) = $2,100.
    expect(s.holdingsValueHome.amount.toString()).toBe('2100')
    // total = cash 5,000 + 2,100 = 7,100.
    expect(s.totalValueHome.amount.toString()).toBe('7100')
    // unrealized = -100 (JPY) + 200 (AAPL) = +100.
    expect(s.unrealizedHome.amount.toString()).toBe('100')
    expect(s.hasPending).toBe(false)
  })

  it('flags pending and excludes unpriced positions from totals', () => {
    const s = summarizePortfolio({
      ...inputs,
      priceOf: (sym: string) => (sym === 'AAPL.US' ? prices[sym] : null),
    })
    expect(s.hasPending).toBe(true)
    // Only AAPL counts: cash 5,000 + 1,200 = 6,200.
    expect(s.totalValueHome.amount.toString()).toBe('6200')
  })
})
