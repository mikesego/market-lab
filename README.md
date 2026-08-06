# Market Lab

Market Lab is a classroom stock-market simulation for grades 3–8. Students research familiar public companies and funds, manage a $100,000 practice portfolio, place market or limit orders during U.S. market sessions, and explain the reasoning behind each decision. Teachers get a separate classroom workspace for seasons, rosters, activity, assignments, financial standings, and learning evidence.

The official competition is intentionally simple: the portfolio with the greatest ending equity wins. Because every student in a season starts with the same amount, ranking by ending equity and total return produces the same order. Lessons, journal work, and teacher recognitions are reported separately and never modify financial rank.

## Current deployment mode

The active provider is `alpaca-basic-iex-v1`. It retrieves Alpaca’s active U.S. equity reference universe, real-time IEX snapshots, and adjusted daily bars for Mike’s personal demonstration. Discovery begins with a small educationally curated featured list, while authenticated search, research pages, and simulated trading resolve supported stocks and ETFs on demand. Every balance and order remains simulated; the application never sends an order to Alpaca or any brokerage. There is no synthetic-price fallback: if Alpaca is unavailable or an open-session quote is stale, new fills stop safely.

This free personal-data arrangement must not be treated as permission for public, classroom, or multi-user display. Before sharing the application, replace or upgrade the provider agreement for the intended audience and complete the launch gates in [docs/PRIVACY_LAUNCH_CHECKLIST.md](docs/PRIVACY_LAUNCH_CHECKLIST.md).

## Product areas

- Public site: product explanation, educator information, privacy, terms, accessibility, service status, and student join.
- Student app: dashboard, full-universe stock and ETF search, company/fund pages, live and recorded portfolio charts, watchlist context, market/limit tickets, queued/open/filled orders, cancellation, holdings, returns, learning labs, decision journal, achievements, and financial leaderboard.
- Teacher workspace: Clerk-authenticated season creation, configurable dates/guardrails, pseudonymous student accounts, development-season controls, and an extensive seeded classroom console.
- Trading/accounting engine: immediate eligible fills, good-until-canceled market and limit orders, automatic minute-level matching during U.S. sessions, market calendar, holidays and early closes, cash reservation, concurrency locks, positions, average cost, realized gains, fills, immutable cash ledger, splits, cash dividends, and audit events.
- Operations: health API, authenticated scheduled market-job endpoint, provider readiness signal, and restricted system console.

The full approved product and engineering specification is in [PRODUCT_SPEC.md](PRODUCT_SPEC.md).

## Stack

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4
- Clerk for adult/teacher authentication
- Pseudonymous class-code + username + PIN authentication for students
- Neon Postgres, Drizzle ORM, and generated SQL migrations
- Decimal.js for money/share calculations
- Vitest for financial/calendar unit tests
- Playwright and axe-core for responsive end-to-end and accessibility tests
- Vercel for hosting

## Local setup

Requirements: Node.js 20+, npm, and a Postgres database.

1. Copy `.env.example` to `.env.local` and fill the required values.
2. Install packages with `npm ci`.
3. Apply migrations with `npm run db:migrate`.
4. Create the demonstration class with `npm run db:seed`.
5. Start the app with `npm run dev`.

Open [http://localhost:3000](http://localhost:3000).

Seeded student login:

- Class code: `OAK-724`
- Username: `AveryFox`
- PIN: `2468`

The shared demo PIN is deliberate and must never be copied into a real class. Teacher-created accounts use a teacher-selected unique PIN whose one-way scrypt hash is stored.

## Environment variables

See [.env.example](.env.example). Important values are:

- `DATABASE_URL` and `DATABASE_URL_UNPOOLED`: Neon/Postgres connections.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`: adult authentication.
- `NEXT_PUBLIC_APP_URL`: canonical production origin.
- `STUDENT_AUTH_PEPPER`: independent server secret for hashing login-rate-limit identifiers.
- `CRON_SECRET`: bearer credential for `/api/jobs/market`.
- `OPERATOR_EMAILS`: comma-separated adults allowed to use `/ops` in production.
- `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY`: server-only Alpaca market-data credentials.

Never expose provider credentials or privileged database credentials to the browser. `NEXT_PUBLIC_` is reserved for intentionally public values.

## Commands

```bash
npm run dev             # development server
npm run check           # lint, typecheck, unit tests, and production build
npm run test:e2e        # desktop and mobile browser journeys + accessibility
npm run db:generate     # generate a migration from schema changes
npm run db:migrate      # apply migrations
npm run db:seed         # idempotently seed the demo
npm run db:reset-demo   # erase and rebuild only OAK-724 demo data
```

## Protected market jobs

Queued/open orders and due corporate actions are processed by the protected route below. Vercel invokes its `GET` handler every minute from 13:00–21:59 UTC on weekdays, a daylight-saving-safe window covering the complete 9:30 a.m.–4:00 p.m. America/New_York regular session. The route checks the official application calendar and fresh quote state before any fill, so premarket, after-hours, weekends, holidays, and early-close periods do not execute orders.

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://stocks.mikesego.com/api/jobs/market
```

Market orders submitted during an open session fill immediately when the quote is fresh. Otherwise they wait for the first eligible scheduled check. Limit orders remain good until canceled or the season ends and fill only when the current executable price satisfies the limit. The endpoint uses transactional row locks, state guards, and idempotent provider event IDs, so overlapping invocations do not double-fill an order or double-apply a corporate action.

## Data model and safety

The ledger, fills, and audit trail are server-owned. Clients submit intent; they never set balances, fill prices, rank, or ownership identifiers. Every teacher-owned route verifies the authenticated adult and the specific season owner. Student sessions use random opaque tokens in `HttpOnly`, `Secure` production cookies. Failed student logins are rate-limited using HMAC-derived device/network identifiers rather than raw IP storage.

Market Lab is educational software, not a broker, adviser, or recommendation engine. It never connects student actions to real brokerage orders.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Market-data provider and launch recommendation](docs/MARKET_DATA_PROVIDER.md)
- [Operations runbook](docs/OPERATIONS_RUNBOOK.md)
- [Privacy and launch checklist](docs/PRIVACY_LAUNCH_CHECKLIST.md)
- [Testing](docs/TESTING.md)
