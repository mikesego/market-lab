# Testing

## Automated suites

`npm run test` covers pure financial calculations, U.S. market-calendar behavior, and Alpaca response normalization. Add table-driven cases whenever a rule or edge case changes.

`npm run test:e2e` runs the critical public, teacher-demo, and student-trading journeys on desktop Chromium and a mobile viewport. It includes axe-core scans for the public experience.

`npm run check` is the release gate for lint, TypeScript, unit tests, and a production Next.js build.

## Required provider conformance tests

Before multi-user launch, expand mocked Alpaca/provider response fixtures for quotes, bars, holidays, half-days, split adjustment, cash dividends, symbol changes, stale data, rate limits, malformed responses, provider downtime, and duplicate events. CI must validate response contracts without depending on an open market or live credentials; these fixtures are test inputs, not an application data mode.

## Financial invariant tests to expand

- Multiple waiting buy orders cannot spend the same cash.
- Multiple waiting sells cannot reserve the same shares.
- Concurrent duplicate client order IDs create one order.
- Fill retry creates one fill and one ledger event.
- Split adjusts positions and waiting order quantity/limit consistently.
- Dividend credits eligible record-date holdings exactly once.
- Sell realized gain and remaining average cost reconcile.
- Ties receive the same financial rank.
- Lessons, journal entries, and awards cannot alter financial order.

## Manual release checks

- Keyboard-only navigation through join, trade, cancel, lesson, and teacher paths.
- Screen-reader names/status announcements and chart alternatives.
- 320px, phone, tablet, laptop, and wide desktop layouts.
- Reduced motion, 200% zoom, and contrast.
- Closed, pre-market, open, after-hours, holiday, and early-close tickets.
- Slow network, database/provider error, duplicate submit, refresh, and back-button behavior.
- Production custom domain, TLS, health endpoint, error logging, and job authentication.

## Classroom regression and database targets

`tests/unit/classroom.test.ts` covers decimal accounting, rules, atomic IndexedDB changes, retries, and backup validation. `tests/e2e/classroom.spec.ts` covers offline close/reopen, saved-price execution, refreshed-price adoption, lost acknowledgements, credential/receipt isolation, split/dividend reconciliation, real provider setup, and enrollment beyond 15 with 16 concurrent uploads.

The classroom browser tests write UUID-owned fixtures through the configured database and real API, then clean them up. `DATABASE_URL` must identify the same database as the server specified by `PLAYWRIGHT_BASE_URL`. A preview URL alone does not isolate data; current Vercel database variables span Development, Preview, and Production. Prefer a disposable database for full tests. The core student journey places an order in the seeded demo and is not read-only. Never reset a real class or the shared database to make a test pass.

Example against an explicitly verified matching test server:

```sh
PLAYWRIGHT_BASE_URL=https://your-verified-preview.example npm run test:e2e -- tests/e2e/classroom.spec.ts
```

Automated Chromium tests do not replace physical Fire/Silk checks: prepare, disconnect, buy/sell, reload, close/reopen offline, reconnect, verify one server fill per trade and refreshed prices. Test each actual tablet/profile. See `CLASSROOM_OFFLINE.md`.
