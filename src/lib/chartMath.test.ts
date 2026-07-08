import { describe, expect, it } from 'vitest'
import {
  computeGeometry,
  filterByRange,
  nearestPointIndex,
  type ChartPoint,
} from './chartMath'

const box = { width: 300, height: 100, padding: 10 }

describe('computeGeometry', () => {
  it('returns null for an empty series', () => {
    expect(computeGeometry([], box)).toBeNull()
  })

  it('maps the first and last point to the horizontal edges', () => {
    const points: ChartPoint[] = [
      { at: 0, value: 100 },
      { at: 1000, value: 110 },
      { at: 2000, value: 90 },
    ]
    const geo = computeGeometry(points, box)!
    expect(geo.screenPoints[0].x).toBeCloseTo(box.padding, 5)
    expect(geo.screenPoints[2].x).toBeCloseTo(box.width - box.padding, 5)
  })

  it('never divides by zero for a flat series', () => {
    const points: ChartPoint[] = [
      { at: 0, value: 500 },
      { at: 1000, value: 500 },
    ]
    const geo = computeGeometry(points, box)!
    expect(Number.isFinite(geo.screenPoints[0].y)).toBe(true)
    expect(Number.isFinite(geo.screenPoints[1].y)).toBe(true)
    // Both points share a value, so they land on the same Y.
    expect(geo.screenPoints[0].y).toBeCloseTo(geo.screenPoints[1].y, 5)
  })

  it('places a higher value closer to the top (smaller Y)', () => {
    const points: ChartPoint[] = [
      { at: 0, value: 100 },
      { at: 1000, value: 200 },
    ]
    const geo = computeGeometry(points, box)!
    expect(geo.screenPoints[1].y).toBeLessThan(geo.screenPoints[0].y)
  })

  it('closes the area path down to the baseline', () => {
    const points: ChartPoint[] = [
      { at: 0, value: 100 },
      { at: 1000, value: 200 },
    ]
    const geo = computeGeometry(points, box)!
    expect(geo.areaPath.endsWith('Z')).toBe(true)
    expect(geo.areaPath).toContain(`${(box.height - box.padding).toFixed(2)}`)
  })
})

describe('nearestPointIndex', () => {
  const pts = [{ x: 0 }, { x: 50 }, { x: 100 }]

  it('snaps to the closest screen point', () => {
    expect(nearestPointIndex(pts, 40)).toBe(1)
    expect(nearestPointIndex(pts, 10)).toBe(0)
    expect(nearestPointIndex(pts, 90)).toBe(2)
  })

  it('handles a single point', () => {
    expect(nearestPointIndex([{ x: 5 }], 999)).toBe(0)
  })
})

describe('filterByRange', () => {
  const day = 24 * 60 * 60 * 1000
  const points = Array.from({ length: 100 }, (_, i) => ({ at: i * day }))
  const end = points[points.length - 1].at

  it('keeps everything for ALL', () => {
    expect(filterByRange(points, 'ALL')).toHaveLength(100)
  })

  it('keeps a trailing 7-day window ending at the last point', () => {
    const filtered = filterByRange(points, '7D')
    expect(filtered[filtered.length - 1].at).toBe(end)
    expect(filtered.every((p) => p.at >= end - 7 * day)).toBe(true)
    expect(filtered.length).toBe(8) // days 93..100 inclusive
  })

  it('falls back to the last two points when a window is too sparse', () => {
    const sparse = [{ at: 0 }, { at: 200 * day }]
    const filtered = filterByRange(sparse, '7D')
    expect(filtered).toHaveLength(2)
  })
})
