import { describe, expect, it } from 'vitest'
import { fxRate, format, money } from './money'
import {
  applyBuy,
  applySell,
  emptyPosition,
  identityFx,
  valuePosition,
} from './portfolio'

describe('portfolio FX-aware P&L', () => {
  it('a stock can rise in native currency yet lose money in home currency', () => {
    // USD home user buys a Tokyo stock priced in JPY.
    // Buy 10 shares @ ¥1,000 when 1 JPY = 0.0090 USD  → cost 90 USD.
    let pos = emptyPosition('7203.TSE', 'JPY', 'USD')
    pos = applyBuy(pos, 10, 1000, fxRate('JPY', 'USD', 0.009))

    expect(pos.quantity.toString()).toBe('10')
    expect(pos.avgCostNative.toString()).toBe('1000')
    // 10 * 1000 * 0.009 = 90 USD
    expect(format(pos.costBasisHome)).toBe('$90.00')

    // Later: stock rises 5% to ¥1,050, but the yen weakens to 1 JPY = 0.0080 USD.
    const val = valuePosition(pos, 1050, fxRate('JPY', 'USD', 0.008))

    // Up in native: 10 * 1050 = ¥10,500 vs ¥10,000 cost → +¥500.
    expect(val.unrealizedNative.amount.toNumber()).toBeCloseTo(500, 6)
    expect(val.unrealizedNative.amount.isPositive()).toBe(true)

    // Down in home: 10 * 1050 * 0.008 = 84 USD vs 90 USD basis → -6 USD.
    expect(val.marketValueHome.amount.toNumber()).toBeCloseTo(84, 6)
    expect(val.unrealizedHome.amount.toNumber()).toBeCloseTo(-6, 6)
    expect(val.unrealizedHome.amount.isNegative()).toBe(true)
  })

  it('weighted-average native cost across two buys', () => {
    let pos = emptyPosition('AAPL.US', 'USD', 'USD')
    pos = applyBuy(pos, 10, 100, identityFx('USD'))
    pos = applyBuy(pos, 30, 200, identityFx('USD'))
    // (10*100 + 30*200) / 40 = 175
    expect(pos.avgCostNative.toString()).toBe('175')
    expect(format(pos.costBasisHome)).toBe('$7,000.00')
  })

  it('realizes home-currency P&L proportionally on a partial sell', () => {
    let pos = emptyPosition('AAPL.US', 'USD', 'USD')
    pos = applyBuy(pos, 10, 100, identityFx('USD')) // basis 1000 USD
    const { position, realizedHome } = applySell(
      pos,
      4,
      150,
      identityFx('USD'),
    )
    // Sold 4 @150 = 600 proceeds; basis removed = 400 → realized +200.
    expect(format(realizedHome)).toBe('$200.00')
    expect(position.quantity.toString()).toBe('6')
    // Remaining basis 600 USD.
    expect(format(position.costBasisHome)).toBe('$600.00')
  })

  it('rejects overselling', () => {
    let pos = emptyPosition('AAPL.US', 'USD', 'USD')
    pos = applyBuy(pos, 5, 100, identityFx('USD'))
    expect(() => applySell(pos, 6, 100, identityFx('USD'))).toThrow(
      /only 5 held/,
    )
  })

  it('formats JPY with zero minor units and USD with two', () => {
    expect(format(money(1050, 'JPY'))).toBe('¥1,050')
    expect(format(money(1050.5, 'USD'))).toBe('$1,050.50')
  })
})
