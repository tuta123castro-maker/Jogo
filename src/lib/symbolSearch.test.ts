import { describe, expect, it } from 'vitest'
import { MIN_QUERY_LENGTH, normalizeQuery } from './symbolSearch'

describe('normalizeQuery', () => {
  it('trims and lowercases', () => {
    expect(normalizeQuery('  Apple  ')).toBe('apple')
  })

  it('is consistent for the min-length guard', () => {
    expect(normalizeQuery('a').length).toBeLessThan(MIN_QUERY_LENGTH)
    expect(normalizeQuery('ap').length).toBeGreaterThanOrEqual(MIN_QUERY_LENGTH)
  })
})
