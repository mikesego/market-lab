# Market-data provider plan

## Current personal-demo implementation

Market Lab now uses **Alpaca Basic with the real-time IEX feed**. This is the recommended free choice for Mike’s strictly personal demo because Alpaca supplies an active U.S. equity reference universe, live IEX snapshots, and historical bars through clean REST APIs. Twelve curated investments remain featured for approachable browsing, but authenticated users can search, research, and simulate trades in any active, tradable U.S.-listed stock or ETF that the adapter supports.

The server-only `alpaca-basic-iex-v1` adapter:

- requests multi-symbol IEX snapshots and adjusted daily bars;
- searches Alpaca reference assets and persists newly opened instruments on demand;
- preserves last trade, bid, ask, previous close, source timestamp, feed, and staleness;
- marks portfolios at the latest trade and simulates buys at the ask and sells at the bid when available;
- coalesces quote reads for three seconds and retries transient upstream failures;
- batches automatic waiting-order quote checks in groups of no more than 25 symbols;
- blocks fills when the regular session is closed or an open-session quote is more than two minutes old;
- checks waiting market and limit orders automatically about once per minute during the regular session;
- never substitutes synthetic prices and never sends a brokerage order.

Alpaca credentials stay in Vercel environment variables and `.env.local`; they must never be committed or exposed with a `NEXT_PUBLIC_` prefix. The current use is personal only. Before the URL is shared, confirm an upgraded agreement or switch to a provider whose contract permits the intended external display and simulated-trading use.

## Recommendation

For the first real-student launch, obtain a written business agreement for approximately 15-minute-delayed U.S. equities and ETF data from **Massive (formerly Polygon.io)** and implement it behind `MarketDataProvider`. The agreement must explicitly permit authenticated external display to students and teachers, simulated execution, server-side storage/caching, derived portfolio valuation, and the expected number of users.

Why this is the leading fit:

- broad U.S. stock and ETF quote/aggregate/reference coverage;
- documented splits and dividend endpoints;
- a specific Stocks for Business path rather than an individual developer plan;
- a straightforward later path to exchange-licensed products if real-time becomes worth the cost;
- a clean API shape for the adapter already present in this repository.

Do not launch on a Massive individual plan. Its personal market-data terms are not a substitute for commercial display/redistribution rights.

## Alternatives

- **Intrinio Startup/Small Business** is the strongest fallback when transparent commercial pricing or bundled fundamentals matter more. Confirm external display, user counts, delayed/real-time status, exchange fees, and redistribution in writing.
- **Twelve Data Venture or higher** can support commercial use, but redistribution/display and exchange licensing still require contract confirmation. It is a reasonable comparison bid.
- **Cboe One Summary** is a possible real-time phase-two source. It represents Cboe markets rather than a full consolidated U.S. tape and carries distributor/consolidation/user fees, so the UI and simulated-fill methodology must accurately describe that coverage.

The provider decision is a licensing decision as much as a technical one. Marketing pages saying “commercial use” are not sufficient for a child-facing multi-user display product.

## Required launch capabilities

- Eligible U.S. common stocks and selected ETFs.
- Last trade or licensed bid/ask, with source timestamp and delay metadata.
- Regular-session status and official exchange calendar exceptions.
- Historical aggregates for charts and benchmark comparison.
- Symbol/reference changes, delistings, splits, and cash dividends.
- Written caching, retention, attribution, derived-data, and display rules.
- Production and non-production credential policy.
- Rate limits sized for holdings, waiting orders, visible discovery pages, and teacher dashboards.

If licensed bid/ask is unavailable, use the explicit last-trade fill model in the product specification and label it. Never synthesize a spread and present it as market data.

## Adapter conformance checklist

1. Map vendor identifiers to stable internal instruments and preserve symbol history.
2. Normalize price, previous close, change, timestamps, session state, delay, source, and staleness.
3. Reject unknown, stale beyond policy, halted, or ineligible instruments from new orders.
4. Cache only within contractual limits; never expose a general-purpose quote proxy.
5. Ingest corporate actions with vendor event IDs and verify idempotent replays.
6. Record the quote basis used for every fill.
7. Reconcile representative quotes, historical bars, splits, dividends, and market-calendar edge cases.
8. Load-test open-order polling and portfolio valuation within vendor rate limits.
9. Add provider health, lag, error-rate, and stale-symbol alerts to operations.
10. Complete a written entitlement review before changing the product’s `personal-demo` usage mode.

## Robinhood boundary

The runtime does not use Robinhood MCP. That connection may be used manually and read-only for development spot checks, but it is not an application data source or display license and must never be connected to Market Lab order submission. Market Lab creates simulated fills only; it never places brokerage orders.
