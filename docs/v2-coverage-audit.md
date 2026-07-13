# Open Markets v2 — Coverage Audit (SPEC-v2 STEP 1)

**Status:** ✅ Signed off — **STEP 2 not pursued** (see "Decisions — RESOLVED").
The expansion is on hold because the chosen EODHD tier is *free*, which serves
US data only.

**Date:** 2026-07-08

---

## 0. Reality check before we start (must read)

The v2 spec's prerequisite is *"v1 is already built and running."* **It is not.**
The repository is only at **Phase 0**:

- ✅ Scaffold (React 19 + Vite + Tailwind, PWA), Supabase schema, money/FX
  foundation (`decimal.js`) with the real-FX-effect P&L engine + tests.
- ⬜ Auth/onboarding, data layer + caching, trading UI, portfolio graph,
  research + news, search/watchlist/history — **none built** (confirmed on both
  branches; `README.md` build-status list bears this out).

There is also **no v1 market universe defined anywhere** in the code — so there
is no "reliable starter set" for v2 to expand *from* yet. This changes how STEP
2 should be sequenced (see the decisions section).

## 1. Probe method & its limits

- **No EODHD key is present in this environment** (`.env` absent, no env var).
  I could not authenticate live international probes.
- The public `demo` token works **only for a handful of US symbols**
  (`AAPL.US` returns EOD fine); every international symbol and the
  `exchanges-list` endpoint returns **`Forbidden`**. Verified live:
  - `GET /api/eod/AAPL.US?...&api_token=demo` → 200, OHLCV JSON ✅
  - `GET /api/eod/0700.HK?...&api_token=demo` → `Forbidden`
  - `GET /api/exchanges-list/?api_token=demo` → `Forbidden`
- **Therefore the table below is compiled from EODHD's published coverage /
  documentation, not a live account probe.** The two cells most worth
  re-confirming against the *actual account plan* once a key is available are
  flagged **⚠ verify**: (a) whether a market has a delayed-intraday feed on your
  tier, and (b) the Bucharest (Romania) exchange suffix.

## 2. Candidate market coverage table

Exchange suffixes are EODHD's virtual-exchange codes appended to the symbol
(e.g. `0700.HK`). "Data quality" is the *best realistically available* feed.

| Market | Exchange (EODHD suffix) | Currency | On EOD "All-World" plan? | Delayed intraday? | Fundamentals | News | Symbol quirks |
|---|---|---|---|---|---|---|---|
| **Hong Kong** | HKEX (`.HK`) | HKD | ✅ Yes | ⚠ Available on higher tier (verify) | ✅ Good | ✅ Good | Numeric codes w/ **leading zeros** — Tencent = `0700.HK`, Alibaba = `9988.HK`. Must zero-pad. |
| China A — Shanghai | SSE (`.SHG`) | CNY | ✅ Yes | ❌ EOD-only in practice | ⚠ Partial | ⚠ Thin | 6-digit numeric codes (`600519.SHG`). |
| China A — Shenzhen | SZSE (`.SHE`) | CNY | ✅ Yes | ❌ EOD-only in practice | ⚠ Partial | ⚠ Thin | 6-digit numeric codes (`000001.SHE`). A-share foreign-access caveats. |
| **Saudi Arabia** | Tadawul (`.SR`) | SAR | ✅ Yes | ❌ EOD-only | ⚠ Partial | ⚠ Thin | Numeric codes (`2222.SR` = Aramco). |
| **Turkey** | Borsa Istanbul (`.IS`) | TRY | ✅ Yes | ❌ EOD-only | ✅ Decent | ⚠ Thin | Ticker codes (`THYAO.IS`). High inflation ⇒ big FX swings (good for the FX-effect, worth noting). |
| **Poland** | Warsaw GPW (`.WAR`) | PLN | ✅ Yes | ❌ EOD-only | ✅ Decent | ⚠ Thin | Ticker codes (`PKN.WAR`). |
| **Romania** | Bucharest BVB (`.RO` ⚠ verify) | RON | ✅ Yes | ❌ EOD-only | ⚠ Thin | ⚠ Sparse | Suffix needs live confirmation; small market, thin data. |
| **Portugal** | Euronext Lisbon (`.LS`) | EUR | ✅ Yes | ⚠ Possible (Euronext, verify) | ✅ Good | ✅ Decent | Ticker codes (`GALP.LS`, `EDP.LS`). EUR = no new currency. |
| **Norway** | Oslo Børs (`.OL`) | NOK | ✅ Yes | ⚠ Possible (verify) | ✅ Good | ✅ Decent | Ticker codes (`EQNR.OL`). |
| **Sweden** | Nasdaq Stockholm (`.ST`) | SEK | ✅ Yes | ⚠ Possible (verify) | ✅ Good | ✅ Decent | **Share-class dash**: `ERIC-B.ST`, `VOLV-B.ST`. Normalizer must keep the `-B`. |
| **Finland** | Nasdaq Helsinki (`.HE`) | EUR | ✅ Yes | ⚠ Possible (verify) | ✅ Good | ✅ Decent | Ticker codes (`NOKIA.HE`). EUR = no new currency. |
| **Russia** | MOEX (`.MCX`) | RUB | ⚠ Data exists but… | ❌ | ⚠ | ⚠ | **See §4 — recommend DEFER.** |

## 3. New currencies introduced

Already in the registry (`src/lib/currency.ts`): USD, EUR, GBP, CNY, CAD, JPY,
KRW, INR, AUD, BRL, CHF, HKD.

**New native currencies these markets add:** `SAR`, `TRY`, `PLN`, `RON`, `NOK`,
`SEK` (and `RUB` only if Russia is un-deferred). HK (HKD) and Portugal/Finland
(EUR), and China (CNY) need **no new currency**. Each new currency needs:
(a) a `CurrencyMeta` entry, and (b) an FX pair into all four home currencies
(USD/EUR/GBP/CNY) in the FX layer.

## 4. Russia (MOEX) — recommendation: **DEFER**

- EODHD does technically carry `.MCX` history, but post-2022 sanctions make the
  **redistribution licence unclear**, and this app *redistributes* prices to
  its users. That fails the spec's bar of *"a legally clean, redistributable
  data source."*
- Data reliability is poor (frozen/delisted names, ADR chaos).
- Spec guidance: *"Assume likely blocked; if so, defer and report that."* →
  **Defer.** Revisit only if you obtain an explicitly redistributable source.

## 5. What (if anything) requires paying up

This depends on **which EODHD plan the account is on today** — which I can't see
without the key. The shape of the answer (verify exact current pricing at
eodhd.com/pricing):

- **EOD across all these markets** is covered by EODHD's entry paid tier
  ("EOD Historical Data / All-World", historically ~US$20/mo). If the account is
  already paid at that level, **adding these markets as EOD-only costs nothing
  extra.**
- **Delayed intraday** is *not* uniformly available for these markets at any
  price — several (Tadawul, Warsaw, Bucharest, Shanghai/Shenzhen) are **EOD-only
  regardless of tier.** Where delayed intraday *is* available (HK, Euronext
  Lisbon, Nordics), it typically requires the **"All-In-One"** bundle
  (historically ~US$100/mo), which also unlocks fundamentals + news breadth.
- **Fundamentals + News** for the research page: broad but uneven; strongest for
  Nordics/Portugal/Turkey, thin for Romania and China A-shares.

**Net:** the cheapest honest path is to add every confirmed market **as
end-of-day only** on the plan v1 already uses, and only consider the All-In-One
upgrade if you specifically want delayed intraday on the handful of markets that
support it.

## 6. Addability summary

| Verdict | Markets |
|---|---|
| ✅ Add now, EOD-only | Hong Kong, Saudi Arabia (Tadawul), Turkey (Borsa Istanbul), Poland (Warsaw), Portugal (Lisbon), Norway (Oslo), Sweden (Stockholm), Finland (Helsinki) |
| ✅ Add, EOD-only, thinner data — confirm suffix/depth | Romania (Bucharest), China A-shares (Shanghai/Shenzhen) |
| ⏸️ Defer | Russia (MOEX) — licence/redistribution not clean |

---

## Decisions — RESOLVED (2026-07-08)

1. **v1 gap:** Build v2 on the Phase-0 base (don't build full v1 first).
2. **Paid tier / cost:** *Free tier only.*
3. **EOD-only display:** Include with a clear "end-of-day only" label.
4. **Hard markets:** Include Romania + China A-shares; **Russia deferred.**

### Outcome: expansion NOT pursued

Decision 2 (free tier) is decisive. **EODHD's free tier serves US end-of-day
data only (~20 calls/day); none of the candidate international markets are
available for free at any data quality.** Verified live in §1: even the `demo`
token returns `Forbidden` for `0700.HK` while `AAPL.US` works.

Given decision 3 (don't reconsider paying; "don't expand — stay free/US"),
**there are no markets to add**, so STEP 2–6 are not built. Decisions 1, 3, and
4 are recorded for whenever a paid EODHD key (≥ All-World EOD, ~US$20/mo) is
obtained — at which point this audit's §6 addability table and the edge-case
handling in SPEC-v2 STEP 2 become actionable exactly as written.

**To resume later:** obtain an All-World EOD key, then implement STEP 2 in the
spec's build order using §6 (add HK + the 8 clean markets + Romania + China
A-shares as **EOD-only**, defer Russia), §3 (new currencies SAR/TRY/PLN/RON/
NOK/SEK), and the per-market symbol quirks in §2.

### Plan-independent scaffolding — BUILT (free, no data feed needed)

To make "resume later" a flip of a key rather than a rebuild, the parts of
STEP 2 that don't depend on a live feed are already implemented and tested:

| Concern (STEP 2) | Module | What it does |
|---|---|---|
| Universe + EOD-only labeling (2.1) | `src/lib/markets.ts` | Exchange registry (suffix, currency, timezone, calendar, `dataQuality`, `requiresPaidTier`); `dataQualityLabel()`; Russia in `DEFERRED_EXCHANGES`. |
| Extended FX pairs (2.2) | `src/lib/fx.ts` | New currencies added to `currency.ts`; `universeFxPairs()` enumerates every native→home pair the FX cache must hold. |
| Trading hours & holidays (2.3) | `src/lib/exchange-hours.ts` | `exchangeStatus()` → open / closed / weekend / holiday, timezone-correct, with lunch breaks and Tadawul's Sun–Thu week. |
| Ticker/suffix normalization (2.4) | `src/lib/symbols.ts` | `parseSymbol()` / `normalizeSymbol()` → canonical `CODE.EXCHANGE`, HK zero-padding, Nordic share-class dashes. |

Covered by `markets.test.ts`, `fx.test.ts`, `symbols.test.ts` (21 tests). What
remains gated behind a paid key: live price/fundamentals/news fetching and the
UI wiring that renders these labels and statuses.
