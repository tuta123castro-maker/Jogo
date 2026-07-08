import { describe, expect, it } from 'vitest'
import { FUNDAMENTALS_TTL_MS, NEWS_TTL_MS, isResearchStale } from './research'

const now = Date.UTC(2026, 0, 1, 12, 0, 0)
const iso = (msAgo: number) => new Date(now - msAgo).toISOString()

describe('isResearchStale', () => {
  it('treats fundamentals as fresh within a day', () => {
    expect(isResearchStale(iso(FUNDAMENTALS_TTL_MS - 1000), FUNDAMENTALS_TTL_MS, now)).toBe(
      false,
    )
  })

  it('treats fundamentals older than a day as stale', () => {
    expect(isResearchStale(iso(FUNDAMENTALS_TTL_MS + 1000), FUNDAMENTALS_TTL_MS, now)).toBe(
      true,
    )
  })

  it('treats news as fresh within an hour but stale after', () => {
    expect(isResearchStale(iso(NEWS_TTL_MS - 1000), NEWS_TTL_MS, now)).toBe(false)
    expect(isResearchStale(iso(NEWS_TTL_MS + 1000), NEWS_TTL_MS, now)).toBe(true)
  })

  it('treats an unparseable timestamp as stale', () => {
    expect(isResearchStale('not-a-date', NEWS_TTL_MS, now)).toBe(true)
  })
})
