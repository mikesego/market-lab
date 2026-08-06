# Operations runbook

## Routine health

- `GET /api/health` must return HTTP 200 with database `ok` and the expected provider ID.
- `/ops` is restricted to Clerk adults listed in `OPERATOR_EMAILS` (or a stored `operator` role).
- Check waiting-order count, recent audit events, provider status, database availability, Vercel errors, and p95 latency.
- In licensed mode, additionally check quote age, vendor error rate, corporate-action lag, and symbol coverage.

## Market job

Vercel Cron calls `GET /api/jobs/market` every minute from 13:00–21:59 UTC on weekdays and supplies `Authorization: Bearer <CRON_SECRET>`. Operators may call `POST` with the same credential for an immediate retry. The job processes waiting orders and due corporate actions. A 401 means the credential is missing or incorrect. A 500 means the next scheduled invocation will retry still-pending work; inspect logs if failures repeat.

The broad UTC window covers the full Eastern-time session through daylight-saving changes. The matcher independently requires a fresh open-session quote, so the extra pre/post-market invocations cannot create fills. Keep overlapping invocations safe; transaction locks and idempotency keys are intentional defenses, not a substitute for monitoring.

## Incident priorities

1. Freeze new order acceptance when quote eligibility, accounting correctness, or authorization is uncertain.
2. Preserve database and provider logs; do not edit ledger rows in place.
3. Identify affected games, portfolios, orders, symbols, and timestamps.
4. Reconcile from immutable fills, ledger events, provider events, and audit events.
5. Communicate a plain-language classroom status; mark rankings provisional when material valuation is uncertain.
6. Repair with an auditable compensating event or tested migration.
7. Write a post-incident record before resuming real-student operation.

## Common cases

### Provider unavailable or stale

Stop new simulated fills for affected symbols. Carry the last valid valuation with a stale label; do not claim it is current. Rankings remain provisional. Resume only after health and freshness checks recover.

### Market job delayed

Run the protected endpoint manually, inspect waiting-order age, and reconcile fill basis against the published execution policy. Do not backdate a fill without an eligible recorded quote.

### Suspected account misuse

Pause the student, revoke active student sessions, issue a new PIN, and review audit activity. Avoid collecting unnecessary identity information in the investigation.

### Financial mismatch

Pause the affected game. Compare opening deposit plus ledger events to cash, fills to positions, and prices to the recorded quote basis. Never patch a displayed total without fixing the source accounting event.

## Backup and recovery

Before real-student launch, enable Neon point-in-time recovery/retention appropriate to the service level, document restoration owners, and practice a restore into an isolated environment. Keep schema migrations additive and review destructive changes separately.

## Release sequence

1. Run `npm ci` and `npm run check` from a clean checkout.
2. Apply migrations before code that requires them.
3. Deploy to Vercel preview and execute `npm run test:e2e` against the preview URL.
4. Promote/deploy production, check `/api/health`, and execute production smoke tests.
5. Confirm the custom domain and TLS certificate.
6. Monitor errors and waiting orders during the release window.
