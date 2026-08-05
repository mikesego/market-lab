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

## Provider replacement

The replay provider and a future licensed provider return the same normalized quote/series shapes. Production work adds a provider implementation, server credentials, contract-driven cache/attribution rules, corporate-action ingestion, and conformance tests. Portfolio, classroom, and learning code should not change.

The production adapter should evolve the current synchronous methods into an async, cached implementation if the chosen vendor requires network calls. That is an interface migration localized to the market-data layer and its callers, not a trading-accounting redesign.

## Environments

- Local: local Next server with Neon development branch and Clerk development instance.
- Preview: isolated Vercel deployments; replay data only unless a provider agreement explicitly covers them.
- Production demo: production hostname, conspicuous replay banner, no real students.
- Real-student production: production Clerk instance, licensed displayed data, privacy agreements, monitoring, backups, incident contacts, and launch approval.
