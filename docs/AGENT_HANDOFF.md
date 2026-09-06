# Market Lab: current state and agent handoff

Last reviewed: September 6, 2026. Read this with `AGENTS.md` and `docs/START_HERE.md`. These files are shared context for Codex, Claude Code, and other coding agents; no previous chat, local memory, or Mike-specific plugin is required.

## Product and authority

Mike built Market Lab for classroom teaching. Sonia is an authorized maintainer and teacher: help her change, fix, test, and publish this service when she requests it. Explain outcomes in classroom language and handle the engineering yourself. Account invitations must be accepted before her own credentials can deploy; documentation does not grant platform permissions.

The application is an educational simulation with real market data and simulated money. The requested classroom has about 15 personally owned Fire tablets and intermittent internet. There is no fixed tablet-count limit. Each student uses a distinct account/portfolio and one assigned browser at a time. Do not restore the superseded personal-demo-only, stale-price-blocking, or online-only classroom restrictions from older specifications.

## What is live

| Resource | Location |
| --- | --- |
| Production | https://stocks.mikesego.com |
| Source and production branch | https://github.com/mikesego/market-lab — `main` |
| Teacher seasons | https://stocks.mikesego.com/teacher/games |
| Student sign-in | https://stocks.mikesego.com/join |
| Offline classroom | https://stocks.mikesego.com/classroom |
| Human setup guide | https://stocks.mikesego.com/classroom-guide |
| Vercel project | `market-lab`, team `mikesegos-projects` |
| Vercel dashboard | https://vercel.com/mikesegos-projects/market-lab |
| Project ID | `prj_rhgt3cOOMjhhsl17JAJcRLd6s2TI` |
| Team ID | `team_JsqcvmY1WljrzjT1FVK2RnIn` |
| Database | Neon Postgres via project environment variables; Drizzle schema/migrations |
| Adult authentication | Clerk; student authentication is the app's own class-code/username/PIN flow |
| Market data | Server-only Alpaca Basic IEX snapshots, reference assets, adjusted daily bars |
| DNS | Cloudflare-managed hostname pointing at Vercel |

Native Vercel Git integration builds and publishes pushes to `main`. Do not introduce a second deployment pipeline or a shared personal deployment token. Node 24.x is configured on Vercel. The repository is public: no secrets, student records, backups, invitation links, or personal access tokens belong in Git.

## Execution and synchronization contract

There are two intentionally different trading workflows:

- `/classroom`: a buy or sell completes immediately at the last successfully downloaded **last-trade price**, regardless of internet connection or exchange hours. The tablet durably saves cash, shares, and the completed receipt together before showing success. The device's downloaded season dates and trading rules still apply.
- `/app`: the original online market/limit workflow uses regular-session matching, freshness checks, buy-ask/sell-bid prices when available, and queued/open orders. Portfolios assigned to a classroom device must trade through that device until it is synced and released.

For Classroom, reconnect uploads original completed trades first, then downloads current prices/rules. Existing fills are never repriced on reconnect. New prices update current portfolio valuation and future trade prices. If a price changes while a ticket is being submitted, ask the student to review it. A symbol without a downloaded price cannot be traded offline. No synthetic fallback prices.

| Trigger | Implemented behavior |
| --- | --- |
| Open prepared app / network `online` event | Immediately attempt upload and price refresh |
| Visible app | Check in every randomized 20–25 seconds; refresh if at least 60 seconds since the last successful refresh, normally about 60–75 seconds plus request time |
| Completed trade | Durable local save, immediate upload attempt, request one-off Background Sync where supported |
| Tab becomes visible | Retry sync; refresh prices if due |
| Teacher refresh-all | Record a request on every active assigned device; delivered at its next successful check-in |
| Supported periodic background sync | Request a 15-minute **minimum** interval; browser controls whether/when it runs |
| Offline / failed provider request | Keep the previous complete price pack and original source timestamps |

This is polling, not a tick-by-tick exchange stream. IEX is one exchange and can differ from consolidated feeds. Source time is distinct from download time; no new trade may be available during closures or for a quiet symbol. Backing up trades does not require the price provider to succeed.

A web app cannot guarantee waking a sleeping Fire or opening a closed Silk browser. For dependable unattended fleet sync, leave Classroom open and visible, charge all tablets, reconnect to Wi-Fi, and verify check-ins from the teacher's Devices page. Wake Lock and background APIs are feature-detected. Guaranteed closed-app wake/start would require a native app or device-management solution, neither of which is implemented.

## Code map

| Area | Files |
| --- | --- |
| Standalone offline UI | `src/classroom/app.tsx`, `src/classroom/style.css` |
| Offline shell build | `scripts/build-classroom.mjs`; generated `public/classroom/` is ignored |
| Service worker/cache | `src/classroom/worker.ts`, rewrites/headers in `next.config.ts` |
| Shared decimal rules/accounting | `src/lib/classroom/model.ts` |
| Atomic IndexedDB, tabs, durable receipts | `src/lib/classroom/store.ts` |
| Sync ordering, leases, retry/reconciliation | `src/lib/classroom/sync.ts` |
| Backup validation | `src/lib/classroom/backup.ts` |
| Enrollment, immutable price packs, receipt replay | `src/lib/classroom/server.ts` |
| Device APIs | `src/app/api/classroom/{setup,sync,prices,reconcile,release}/route.ts` |
| Teacher device dashboard / refresh all | `src/app/teacher/games/[gameId]/devices/page.tsx`, `src/app/actions/classroom-teacher.ts` |
| Teacher seasons/roster/assignments | `src/app/actions/teacher.ts`, `src/lib/data/teacher.ts`, `src/app/teacher/games/` |
| Teacher/student identity | `src/lib/auth/`, `src/lib/security/`, `src/app/actions/student-auth.ts` |
| Schema and migrations | `src/db/schema.ts`, `drizzle/`, `drizzle.config.ts` |
| Price feed | `src/lib/market/{provider,alpaca-provider,alpaca-normalize,alpaca-assets}.ts` |
| Original online trading | `src/lib/trading/order-service.ts`, `src/lib/trading/corporate-actions.ts` |
| Scheduled market job | `src/app/api/jobs/market/route.ts`, `vercel.json` |
| Offline regression tests | `tests/unit/classroom.test.ts`, `tests/e2e/classroom.spec.ts`, `tests/fixtures/classroom.ts` |

`predev` and `prebuild` regenerate the standalone classroom. It must reopen without Clerk, external fonts, Next server rendering, or an internet connection. The worker scope is `/classroom`; only allowlisted shell/assets are cached, never teacher HTML, authentication, or API responses. A new worker waits for old tabs to close. Deploying code does not force every offline tablet to update immediately. Keep server APIs compatible with old cached clients and receipts.

## Accounting and recovery invariants

- IndexedDB database `market-lab-classroom-v1` commits account changes and receipts atomically. Serialize foreground/tab/worker mutations; retain local work on every failure.
- Each device has a random scoped bearer credential, hashed server-side, separate from the 14-day online student cookie. It remains assigned until released. Never clear it on normal sign-out.
- One active device per portfolio is enforced under a portfolio row lock; this is not a class-size cap.
- Every receipt includes its sequence, original immutable server-owned price pack, and trade identifier. Server replay recomputes decimal arithmetic and validates downloaded rules. It does not accept arbitrary client balances/prices.
- A transaction writes order/fill, ledger, position, reflection, audit evidence, and sequence acknowledgement together. Duplicate/lost-response retries must not double-fill. Mismatched duplicates and gaps require recovery, not silent discard.
- Corporate actions are reconciled per portfolio. Upload old receipts before applying pending splits/dividends; receive adjusted holdings and new prices together. Obsolete pre-split price packs must not price post-split trades, even for a downloaded stock with zero holdings. A failed reconciliation can briefly hold trading until a successful connection.
- Backup JSON contains a device access credential. Keep it teacher-held and private. Restore only one active copy; release/reprepare when permanently changing devices. Do not commit backups or student PIN lists.
- Clearing browser storage before backup loses unsynced work. Never “fix” sync by deleting IndexedDB. Read the recovery guide first.
- Teachers see the server's last confirmed record, not unknowable work on disconnected tablets. Final standings require all tablets to check in.
- Teacher ownership checks isolate seasons. Sonia can create/manage her own season; signing in does not automatically grant her a season Mike created. Do not silently transfer existing classes or bypass ownership checks.

## Delivered milestones and evidence

- `70dad77`: real teacher classroom workspace.
- `d2f64ee`: automatic online order execution.
- `f4f068d`: complete offline classroom, device sync, guides, schema, and regression coverage.
- `d2d84b7`: correct reconciliation of downloaded price epochs around splits.
- `deeee5b`: 15-tablet wording with flexible capacity; enrollment beyond 15 and 16 concurrent uploads verified.

Migrations through `0007` were applied to production before those releases. Do not infer later migration state from this dated note: inspect the migration journal and target database before a schema change.

Verified before this handoff: 47 unit tests; 12 classroom desktop/mobile browser cases against the deployed API/database; 10 existing desktop/mobile core journeys; lint, typecheck, production build. The September 6 expanded fleet test separately passed real enrollment of a 16th device with 15 already assigned, then 16 simultaneous uploads and retry deduplication. These are automated Chromium/API checks, not certification of physical Silk tablets. Re-run the tests relevant to your change; this historical evidence is not a perpetual passing result.

## Known limits and next work

- Physical Fire/Silk offline reload/reopen and Wi-Fi-return checks remain necessary on every tablet before teaching. Exact Fire models/OS versions have not been verified.
- No guaranteed closed-browser push, wake, kiosk enrollment, or native Fire app.
- Offline support covers portfolio/trading/history/reflections, saved investment information, and lesson reading. Online assignments, completion recording, dynamic research charts, leaderboard, and teacher reports still require connectivity.
- Device price refresh is capped at 100 downloaded investments per tablet; that is a symbol limit, not a device limit. Larger deployments face ordinary provider/network/database capacity constraints; no unlimited-scale claim.
- The split/dividend application machinery exists, but automatic comprehensive external corporate-action ingestion is not implemented by the quotes/assets/bars adapter. Do not promise complete live corporate-event coverage.
- Offline rule changes and pauses take effect after download. The saved season end time is enforced locally; use automatic tablet date/time. Immediate offline classroom stops require collecting devices.
- Shared team portfolios, T+1 lesson mode, and other expansive items in `PRODUCT_SPEC.md` are roadmap/specification material, not proof of implementation.
- Do not assume Development or Preview means a separate database. Current Vercel database variables are shared across those targets and Production. See setup and testing docs before mutations.

## Keep this handoff useful

After substantive work, update this file's current-state notes and `docs/CHANGELOG.md`: behavior changed, commits, migration status, verification, and remaining limitations. Keep detailed teaching steps in `CLASSROOM_OFFLINE.md`, machine setup/release steps in `START_HERE.md`, and credentials outside the repository. Resolve conflicting old wording rather than appending a second contradictory rule.
