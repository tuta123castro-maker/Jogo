/**
 * Per-exchange open / closed status (SPEC-v2 STEP 2.3).
 *
 * Each exchange trades in its own timezone, on its own weekly schedule (most
 * Mon–Fri, Tadawul Sun–Thu), with a per-market holiday calendar and — for HK
 * and mainland China — a midday lunch break. We compute status from the
 * exchange's LOCAL wall-clock time, derived with `Intl.DateTimeFormat` so no
 * timezone library is needed and it behaves identically in Node and browsers.
 *
 * Note: an exchange can be "open" while its prices are still end-of-day only —
 * open/closed and data freshness are independent axes. Callers should show both
 * (see `dataQualityLabel` in markets.ts).
 */

import type { Exchange } from './markets'

export type MarketState = 'open' | 'closed' | 'weekend' | 'holiday'

export interface ExchangeStatus {
  state: MarketState
  isOpen: boolean
  /** Short human-readable explanation, e.g. "Closed · public holiday". */
  reason: string
}

interface ZonedNow {
  /** 'YYYY-MM-DD' in the target timezone. */
  date: string
  /** Minutes since local midnight (0–1439). */
  minutes: number
  /** Weekday, 0=Sun … 6=Sat. */
  weekday: number
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/** Project an instant onto an exchange's local wall clock. */
function zonedNow(at: Date, timezone: string): ZonedNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(at)

  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? ''

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  }
}

/** Parse 'HH:MM' into minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

/** The open trading windows for a session, accounting for a lunch break. */
function sessionWindows(ex: Exchange): Array<[number, number]> {
  const open = toMinutes(ex.hours.open)
  const close = toMinutes(ex.hours.close)
  if (!ex.hours.lunch) return [[open, close]]
  const lunchStart = toMinutes(ex.hours.lunch.start)
  const lunchEnd = toMinutes(ex.hours.lunch.end)
  return [
    [open, lunchStart],
    [lunchEnd, close],
  ]
}

/**
 * Is `ex` open at instant `at` (defaults to now)? A window is open-inclusive of
 * its start and exclusive of its close.
 */
export function exchangeStatus(ex: Exchange, at: Date = new Date()): ExchangeStatus {
  const now = zonedNow(at, ex.timezone)

  if (ex.holidays.includes(now.date)) {
    return { state: 'holiday', isOpen: false, reason: 'Closed · public holiday' }
  }
  if (!ex.weekdays.includes(now.weekday)) {
    return { state: 'weekend', isOpen: false, reason: 'Closed · weekend' }
  }

  const open = sessionWindows(ex).some(
    ([start, end]) => now.minutes >= start && now.minutes < end,
  )
  return open
    ? { state: 'open', isOpen: true, reason: 'Open' }
    : { state: 'closed', isOpen: false, reason: 'Closed · outside trading hours' }
}
