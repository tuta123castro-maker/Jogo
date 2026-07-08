/**
 * Pure geometry for the portfolio value-over-time chart. No DOM, no React —
 * takes plain {at, value} points and a pixel box, returns SVG path strings and
 * the scale functions the component needs for the crosshair/tooltip.
 */

export interface ChartPoint {
  /** Unix ms timestamp. */
  at: number
  value: number
}

export interface ChartBox {
  width: number
  height: number
  /** Inset from the edges so the stroke and end-dot never clip. */
  padding: number
}

export interface ChartGeometry {
  linePath: string
  /** Area path closed down to the baseline, for the ~10% opacity fill. */
  areaPath: string
  minValue: number
  maxValue: number
  scaleX: (at: number) => number
  scaleY: (value: number) => number
  /** Pixel positions of each input point, in the same order. */
  screenPoints: { x: number; y: number; point: ChartPoint }[]
}

export function computeGeometry(
  points: ChartPoint[],
  box: ChartBox,
): ChartGeometry | null {
  if (points.length === 0) return null

  const { width, height, padding } = box
  const minAt = points[0].at
  const maxAt = points[points.length - 1].at
  const rawMin = Math.min(...points.map((p) => p.value))
  const rawMax = Math.max(...points.map((p) => p.value))

  // Guard a flat series (all equal values) so the Y scale doesn't divide by 0.
  const spread = rawMax - rawMin
  const pad = spread === 0 ? Math.max(Math.abs(rawMax) * 0.05, 1) : spread * 0.08
  const minValue = rawMin - pad
  const maxValue = rawMax + pad

  const timeSpan = maxAt - minAt || 1
  const valueSpan = maxValue - minValue || 1

  const scaleX = (at: number) =>
    padding + ((at - minAt) / timeSpan) * (width - padding * 2)
  const scaleY = (value: number) =>
    height - padding - ((value - minValue) / valueSpan) * (height - padding * 2)

  const screenPoints = points.map((point) => ({
    x: scaleX(point.at),
    y: scaleY(point.value),
    point,
  }))

  const linePath = screenPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')

  const baseline = height - padding
  const areaPath =
    screenPoints.length > 0
      ? `M${screenPoints[0].x.toFixed(2)},${baseline} ` +
        screenPoints
          .map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`)
          .join(' ') +
        ` L${screenPoints[screenPoints.length - 1].x.toFixed(2)},${baseline} Z`
      : ''

  return { linePath, areaPath, minValue: rawMin, maxValue: rawMax, scaleX, scaleY, screenPoints }
}

/** Index of the point whose X is closest to `atX` (pixel space). */
export function nearestPointIndex(
  screenPoints: { x: number }[],
  atX: number,
): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < screenPoints.length; i++) {
    const dist = Math.abs(screenPoints[i].x - atX)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

export type RangeKey = '7D' | '30D' | '90D' | 'ALL'

export const RANGE_OPTIONS: RangeKey[] = ['7D', '30D', '90D', 'ALL']

const RANGE_DAYS: Record<Exclude<RangeKey, 'ALL'>, number> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
}

/** Filter points to a trailing window ending at the last point's timestamp. */
export function filterByRange<T extends { at: number }>(
  points: T[],
  range: RangeKey,
): T[] {
  if (range === 'ALL' || points.length === 0) return points
  const end = points[points.length - 1].at
  const days = RANGE_DAYS[range]
  const start = end - days * 24 * 60 * 60 * 1000
  const filtered = points.filter((p) => p.at >= start)
  // Always show at least the last two points so a short history still draws a line.
  return filtered.length >= 2 ? filtered : points.slice(-2)
}
