import { useMemo, useState } from 'react'
import { computeGeometry, filterByRange, nearestPointIndex, RANGE_OPTIONS, type ChartPoint, type RangeKey } from '../lib/chartMath'
import { format, money } from '../lib/money'
import type { HomeCurrency } from '../lib/currency'
import type { SnapshotRow } from '../lib/snapshots'

const BOX = { width: 320, height: 160, padding: 16 }

/**
 * Portfolio value-over-time chart. Single series, so no legend box (the title
 * names it) — the line's color is a status read (up vs. down since the start of
 * the selected range), not a categorical hue. A hairline min/max grid gives
 * scale context, the end value is direct-labeled, and a crosshair + tooltip
 * covers every point on hover/touch. A collapsible table keeps every value
 * reachable without hovering, per the accessibility baseline.
 */
export function PortfolioChart({
  snapshots,
  currency,
}: {
  snapshots: SnapshotRow[]
  currency: HomeCurrency
}) {
  const [range, setRange] = useState<RangeKey>('30D')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const points: ChartPoint[] = useMemo(
    () =>
      snapshots.map((s) => ({
        at: new Date(s.captured_at).getTime(),
        value: Number(s.total_value_home),
      })),
    [snapshots],
  )
  const ranged = useMemo(() => filterByRange(points, range), [points, range])
  const geo = useMemo(() => computeGeometry(ranged, BOX), [ranged])

  if (points.length < 2) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-sm font-medium text-slate-200">Portfolio value</h2>
        <p className="mt-3 text-sm text-slate-400">
          Your value-over-time graph appears once there’s more than one day of
          history.
        </p>
      </section>
    )
  }
  if (!geo) return null

  const first = ranged[0].value
  const last = ranged[ranged.length - 1].value
  const up = last >= first
  const lineColor = up ? '#34d399' : '#fb7185' // emerald-400 / rose-400
  const hover = hoverIndex !== null ? geo.screenPoints[hoverIndex] : null

  function handlePointer(clientX: number, target: SVGSVGElement) {
    const rect = target.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * BOX.width
    setHoverIndex(nearestPointIndex(geo!.screenPoints, x))
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-200">Portfolio value</h2>
        <div className="flex gap-1 rounded-md bg-slate-800/60 p-0.5">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRange(r)
                setHoverIndex(null)
              }}
              className={
                'rounded px-2 py-0.5 text-[11px] font-medium transition ' +
                (range === r
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200')
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${BOX.width} ${BOX.height}`}
          className="w-full touch-none"
          role="img"
          aria-label={`Portfolio value over the selected range, from ${format(
            money(first, currency),
          )} to ${format(money(last, currency))}`}
          onPointerMove={(e) => handlePointer(e.clientX, e.currentTarget)}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="portfolio-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.16} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Hairline min/max gridlines, one shade off the card surface. */}
          <line
            x1={BOX.padding}
            x2={BOX.width - BOX.padding}
            y1={geo.scaleY(geo.maxValue)}
            y2={geo.scaleY(geo.maxValue)}
            stroke="#1e293b"
            strokeWidth={1}
          />
          <line
            x1={BOX.padding}
            x2={BOX.width - BOX.padding}
            y1={geo.scaleY(geo.minValue)}
            y2={geo.scaleY(geo.minValue)}
            stroke="#1e293b"
            strokeWidth={1}
          />

          <path d={geo.areaPath} fill="url(#portfolio-area)" stroke="none" />
          <path
            d={geo.linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* End-of-line marker, ring in the card surface color so it stays legible. */}
          <circle
            cx={geo.screenPoints[geo.screenPoints.length - 1].x}
            cy={geo.screenPoints[geo.screenPoints.length - 1].y}
            r={4}
            fill={lineColor}
            stroke="#0f172a"
            strokeWidth={2}
          />

          {hover ? (
            <>
              <line
                x1={hover.x}
                x2={hover.x}
                y1={BOX.padding}
                y2={BOX.height - BOX.padding}
                stroke="#475569"
                strokeWidth={1}
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r={4}
                fill={lineColor}
                stroke="#0f172a"
                strokeWidth={2}
              />
            </>
          ) : null}
        </svg>

        <div className="mt-1 flex justify-between text-[11px] text-slate-500">
          <span>{new Date(ranged[0].at).toLocaleDateString()}</span>
          <span>{new Date(ranged[ranged.length - 1].at).toLocaleDateString()}</span>
        </div>

        {hover ? (
          <div className="pointer-events-none absolute -top-2 left-0 right-0 flex justify-center">
            <div className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs shadow-lg">
              <p className="font-medium text-slate-100">
                {format(money(hover.point.value, currency))}
              </p>
              <p className="text-slate-400">
                {new Date(hover.point.at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <details className="mt-3 text-xs text-slate-400">
        <summary className="cursor-pointer select-none hover:text-slate-200">
          View as table
        </summary>
        <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-800">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-900 text-slate-500">
              <tr>
                <th className="px-2 py-1 font-normal">Date</th>
                <th className="px-2 py-1 font-normal">Value</th>
              </tr>
            </thead>
            <tbody>
              {ranged
                .slice()
                .reverse()
                .map((p) => (
                  <tr key={p.at} className="border-t border-slate-800">
                    <td className="px-2 py-1 tabular-nums">
                      {new Date(p.at).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-1 tabular-nums text-slate-200">
                      {format(money(p.value, currency))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
