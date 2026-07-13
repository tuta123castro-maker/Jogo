/**
 * Market / exchange universe (SPEC-v2 STEP 2).
 *
 * This is the plan-independent backbone of the v2 market expansion: it names
 * every exchange we intend to support, its EODHD symbol suffix, native
 * currency, timezone, trading calendar, and — crucially for the UI — its
 * DATA QUALITY (delayed intraday vs end-of-day only). See the coverage audit
 * in `docs/v2-coverage-audit.md` for how each entry was decided.
 *
 * ── Free-tier reality ───────────────────────────────────────────────────────
 * On EODHD's FREE tier only `US` returns data. Every non-US exchange here needs
 * at least the paid "All-World EOD" tier before its prices are live. The
 * definitions still carry their weight for free: search, symbol normalization,
 * FX-pair enumeration, and open/closed status all work without any price feed,
 * and light up the day a paid key is added. `requiresPaidTier` records which
 * exchanges are gated so the UI can explain why an asset shows no price.
 */

import type { HomeCurrency } from './currency'

/** Local trading session, expressed in the exchange's own timezone. */
export interface TradingHours {
  /** Session open, 'HH:MM' in the exchange timezone. */
  open: string
  /** Session close, 'HH:MM' in the exchange timezone. */
  close: string
  /** Optional midday break (common on HK / mainland-China / some markets). */
  lunch?: { start: string; end: string }
}

/** How fresh an exchange's prices are — drives the EOD-only UI label. */
export type DataQuality = 'delayed' | 'eod'

export interface Exchange {
  /** EODHD virtual-exchange code = the symbol suffix (without the dot). */
  code: string
  name: string
  country: string
  /** ISO code of the currency instruments trade in on this exchange. */
  currency: string
  /** IANA timezone used for open/closed calculations. */
  timezone: string
  dataQuality: DataQuality
  /** True when the exchange is unavailable on EODHD's free tier. */
  requiresPaidTier: boolean
  hours: TradingHours
  /**
   * Weekdays the exchange trades, 0=Sun … 6=Sat. Most are Mon–Fri; Gulf
   * markets such as Tadawul run Sun–Thu.
   */
  weekdays: readonly number[]
  /**
   * Full-day closures as 'YYYY-MM-DD' in the exchange timezone. SEED DATA —
   * a starting set, not an authoritative annual calendar; verify/extend per
   * year (lunar Eid dates for Tadawul in particular are left to be filled).
   */
  holidays: readonly string[]
}

const MON_FRI: readonly number[] = [1, 2, 3, 4, 5]
const SUN_THU: readonly number[] = [0, 1, 2, 3, 4]

/**
 * The tradeable universe. `US` is the v1 baseline (delayed intraday, free).
 * Everything else is a v2 addition, end-of-day only, gated behind a paid tier.
 * Russia (MOEX) is intentionally ABSENT — deferred for licensing reasons
 * (audit §4); see `DEFERRED_EXCHANGES`.
 */
export const EXCHANGES: readonly Exchange[] = [
  {
    code: 'US',
    name: 'US markets (NYSE / Nasdaq)',
    country: 'United States',
    currency: 'USD',
    timezone: 'America/New_York',
    dataQuality: 'delayed',
    requiresPaidTier: false,
    hours: { open: '09:30', close: '16:00' },
    weekdays: MON_FRI,
    holidays: [
      '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
      '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
    ],
  },
  {
    code: 'HK',
    name: 'Hong Kong (HKEX)',
    country: 'Hong Kong',
    currency: 'HKD',
    timezone: 'Asia/Hong_Kong',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '09:30', close: '16:00', lunch: { start: '12:00', end: '13:00' } },
    weekdays: MON_FRI,
    holidays: ['2026-01-01', '2026-05-01', '2026-10-01', '2026-12-25'],
  },
  {
    code: 'SHG',
    name: 'Shanghai (SSE)',
    country: 'China',
    currency: 'CNY',
    timezone: 'Asia/Shanghai',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '09:30', close: '15:00', lunch: { start: '11:30', end: '13:00' } },
    weekdays: MON_FRI,
    holidays: ['2026-01-01', '2026-05-01', '2026-10-01'],
  },
  {
    code: 'SHE',
    name: 'Shenzhen (SZSE)',
    country: 'China',
    currency: 'CNY',
    timezone: 'Asia/Shanghai',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '09:30', close: '15:00', lunch: { start: '11:30', end: '13:00' } },
    weekdays: MON_FRI,
    holidays: ['2026-01-01', '2026-05-01', '2026-10-01'],
  },
  {
    code: 'SR',
    name: 'Saudi Arabia (Tadawul)',
    country: 'Saudi Arabia',
    currency: 'SAR',
    timezone: 'Asia/Riyadh',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '10:00', close: '15:00' },
    weekdays: SUN_THU,
    holidays: ['2026-09-23'], // Saudi National Day; Eid dates (lunar) TBD.
  },
  {
    code: 'IS',
    name: 'Turkey (Borsa Istanbul)',
    country: 'Turkey',
    currency: 'TRY',
    timezone: 'Europe/Istanbul',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '10:00', close: '18:00' },
    weekdays: MON_FRI,
    holidays: ['2026-01-01', '2026-04-23', '2026-05-01', '2026-10-29'],
  },
  {
    code: 'WAR',
    name: 'Poland (Warsaw GPW)',
    country: 'Poland',
    currency: 'PLN',
    timezone: 'Europe/Warsaw',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '09:00', close: '17:00' },
    weekdays: MON_FRI,
    holidays: ['2026-01-01', '2026-01-06', '2026-05-01', '2026-05-03', '2026-12-25'],
  },
  {
    code: 'RO',
    name: 'Romania (Bucharest BVB)',
    country: 'Romania',
    currency: 'RON',
    timezone: 'Europe/Bucharest',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '10:00', close: '18:00' },
    weekdays: MON_FRI,
    holidays: ['2026-01-01', '2026-01-02', '2026-05-01', '2026-12-01', '2026-12-25'],
  },
  {
    code: 'LS',
    name: 'Portugal (Euronext Lisbon)',
    country: 'Portugal',
    currency: 'EUR',
    timezone: 'Europe/Lisbon',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '08:00', close: '16:30' },
    weekdays: MON_FRI,
    holidays: ['2026-01-01', '2026-04-03', '2026-12-25'],
  },
  {
    code: 'OL',
    name: 'Norway (Oslo Børs)',
    country: 'Norway',
    currency: 'NOK',
    timezone: 'Europe/Oslo',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '09:00', close: '16:20' },
    weekdays: MON_FRI,
    holidays: ['2026-01-01', '2026-04-03', '2026-05-01', '2026-05-17', '2026-12-25'],
  },
  {
    code: 'ST',
    name: 'Sweden (Nasdaq Stockholm)',
    country: 'Sweden',
    currency: 'SEK',
    timezone: 'Europe/Stockholm',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '09:00', close: '17:30' },
    weekdays: MON_FRI,
    holidays: ['2026-01-01', '2026-01-06', '2026-04-03', '2026-12-25'],
  },
  {
    code: 'HE',
    name: 'Finland (Nasdaq Helsinki)',
    country: 'Finland',
    currency: 'EUR',
    timezone: 'Europe/Helsinki',
    dataQuality: 'eod',
    requiresPaidTier: true,
    hours: { open: '10:00', close: '18:30' },
    weekdays: MON_FRI,
    holidays: ['2026-01-01', '2026-01-06', '2026-04-03', '2026-12-25'],
  },
] as const

/** Deferred markets — defined but NOT tradeable. See audit §4. */
export const DEFERRED_EXCHANGES: readonly { code: string; name: string; reason: string }[] = [
  {
    code: 'MCX',
    name: 'Russia (MOEX)',
    reason:
      'Redistribution licence not clean post-sanctions; unreliable data. ' +
      'Deferred per SPEC-v2. Revisit only with an explicitly redistributable source.',
  },
] as const

const BY_CODE: ReadonlyMap<string, Exchange> = new Map(
  EXCHANGES.map((ex) => [ex.code, ex]),
)

/** Look up an exchange by its EODHD suffix code (case-insensitive). */
export function exchangeByCode(code: string): Exchange | undefined {
  return BY_CODE.get(code.trim().toUpperCase())
}

export function isKnownExchange(code: string): boolean {
  return BY_CODE.has(code.trim().toUpperCase())
}

/** Every native currency present in the tradeable universe (deduped). */
export function universeCurrencies(): string[] {
  return [...new Set(EXCHANGES.map((ex) => ex.currency))]
}

/** Human-readable data-quality tag for the UI (SPEC-v2 STEP 2.1). */
export function dataQualityLabel(quality: DataQuality): string {
  return quality === 'eod'
    ? 'End-of-day only · updates once daily'
    : 'Delayed intraday'
}

export type { HomeCurrency }
