# Architecture

## System shape

Market Lab is one Next.js application with server-rendered interfaces and server actions over a relational accounting core. It deliberately separates four boundaries:

1. Public and student-facing presentation.
2. Adult identity and resource authorization.
3. Trading/accounting state transitions.
4. External market-data normalization.

The online market/limit browser submits order intent for server execution. The standalone Classroom browser instead executes immediately at a server-recorded saved price and durably commits its local account and receipt. The server later replays the receipt and independently verifies its original price/rules and arithmetic before acknowledging backup. See `AGENT_HANDOFF.md` and `CLASSROOM_OFFLINE.md` for the full offline contract.

## Request paths

### Student

`class code + username + PIN → rate limit → PIN verification → opaque session cookie → student/game/portfolio context → server action → transactional trading or learning write`

Students do not need email addresses. The session cookie contains only random entropy; the database stores its SHA-256 hash. PINs use salted scrypt hashes. Raw IP addresses are not persisted by application login controls.

### Teacher

`Clerk session → local adult mirror → season ownership check → teacher page/action`

Authentication alone is not authorization. Every owned-season query includes `ownerId = authenticatedAdult.id`. The seeded demo is intentionally public and read-only.

### Trading

`order intent → normalized quote → validation → portfolio row lock → cash/share reservation → fill or queue → position update → fill record → cash ledger → audit event`

Money and share math uses arbitrary-precision decimals. Database constraints and unique provider event IDs enforce idempotency. Waiting orders are handled by the protected market job, never as a rendering side effect.

## Important modules

- `src/lib/market/provider.ts`: stable adapter boundary.
- `src/lib/market/alpaca-provider.ts`: server-only Alpaca Basic REST client, bounded retry, and short quote cache.
- `src/lib/market/alpaca-assets.ts`: authenticated reference-universe lookup and ranked stock/ETF search.
- `src/lib/instruments/service.ts`: on-demand normalization and persistence for newly researched symbols.
- `src/lib/market/alpaca-normalize.ts`: pure response normalization used by the adapter and contract tests.
- `src/lib/market/calendar.ts`: U.S. equity session, weekend, holiday, and early-close logic.
- `src/lib/trading/order-service.ts`: validation, reservation, placement, cancellation, and fill processing.
- `src/lib/trading/corporate-actions.ts`: idempotent splits and cash dividends.
- `src/lib/auth/*`: adult, student session, PIN, and rate-limit controls.
- `src/db/schema.ts`: authoritative relational model.
- `src/app/api/jobs/market/route.ts`: protected background-processing entrypoint.

## Data invariants

- Portfolio cash equals the latest ledger running balance after committed cash events.
- Available cash is cash balance minus cash reserved by waiting buy orders.
- Available shares exclude shares reserved by waiting sell orders.
- A fill has a unique provider event ID.
- A corporate action has a unique provider event ID and one terminal processed state.
- Learning evidence never enters the financial ranking formula.
- Official rank is descending equity; ties share rank.
- Portfolio charts use persisted equity checkpoints; presentation code never invents historical portfolio movement.

## Market-data boundary

The current asynchronous adapter returns normalized reference assets, quote, and series shapes from Alpaca Basic’s U.S. equity and IEX endpoints. Credentials are read only on the server. Discovery shows a curated starting set and searches Alpaca’s active tradable universe on demand. Portfolio valuation uses the latest available trade. Online market/limit buys use the ask and sells use the bid when available, with freshness checks. Classroom buys and sells both use the exact saved last-trade price, including old prices while offline. Neither workflow generates fallback prices.

A future business provider implements the same async interface, so portfolio, classroom, and learning code do not need to change. Comprehensive automatic corporate-action ingestion remains unfinished; applying already-recorded split/dividend events is implemented. Preserve source attribution and conformance tests when changing providers.

## Environments

- Local: local Next server, Clerk development configuration, and authorized project market-data settings. Current Vercel database variables are shared across Development/Preview/Production; verify the actual connection before writes or override both database URLs with an isolated database.
- Preview: separate Vercel code deployments, not automatically isolated databases.
- Production: classroom use at the production hostname with accurately labeled IEX data and simulated money.
- Classroom devices: cached static shell, scoped device access, IndexedDB, immutable price packs, sequential replay, and teacher check-ins. See `CLASSROOM_OFFLINE.md`.
