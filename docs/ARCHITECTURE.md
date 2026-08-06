# Architecture

## System shape

Market Lab is one Next.js application with server-rendered interfaces and server actions over a relational accounting core. It deliberately separates four boundaries:

1. Public and student-facing presentation.
2. Adult identity and resource authorization.
3. Trading/accounting state transitions.
4. External market-data normalization.

The browser never calculates an authoritative balance or fill. It submits an order intent; the server re-reads the portfolio, position, rulebook, and eligible quote inside a transaction before committing anything.

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

## Market-data boundary

The current asynchronous adapter returns normalized quote and series shapes from Alpaca Basic’s IEX feed. Credentials are read only on the server. Portfolio valuation and discovery use the latest trade; simulated buys use the ask and sells use the bid when available. The order engine refuses stale open-session quotes and has no generated-price fallback.

A future business provider implements the same async interface, so portfolio, classroom, and learning code do not need to change. Corporate-action ingestion, contractual cache/attribution rules, and conformance testing remain launch requirements.

## Environments

- Local: local Next server with Neon development branch, Clerk development instance, and Mike’s Alpaca Basic credentials.
- Preview: isolated Vercel deployments with the same personal-only Alpaca access; do not share preview URLs.
- Production demo: production hostname, conspicuous personal-demo/live-IEX banner, Mike as the sole user.
- Real-student production: production Clerk instance, licensed displayed data, privacy agreements, monitoring, backups, incident contacts, and launch approval.
