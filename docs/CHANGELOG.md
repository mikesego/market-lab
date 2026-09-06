# Maintainer change log

## September 6, 2026 — teacher and agent handoff

- Added a shared Codex/Claude entry point, current-state handoff, local setup, teaching steps, deployment/rollback instructions, and known limitations.
- Corrected stale architecture/environment wording: offline trades execute locally and replay on the server; a preview/local URL does not imply a separate database.
- Repository code and teaching docs are public; credentials, private student records, and platform invitation details remain outside Git.
- Validation: documentation links resolve; lint, typecheck, all 47 unit tests, and the production build passed. No application behavior or schema changed in this handoff.
- Platform membership and Sonia's first authenticated deployment are verified separately from this documentation. Do not infer accepted access from this entry.

## September 5–6, 2026 — offline classroom delivered

- `f4f068d`: standalone cached classroom, immediate saved-price trades, durable IndexedDB, authenticated device enrollment, idempotent backup, teacher device dashboard/refresh requests, recovery, guides, and tests.
- `d2d84b7`: split/dividend reconciliation correctly crosses downloaded price epochs, including zero-holding investments.
- `deeee5b`: 15-tablet setup example; no fixed tablet-count cap; real enrollment beyond 15 and concurrent uploads from 16 device credentials verified.
- Production migrations through `0007` applied; detailed verification and practical limits in `AGENT_HANDOFF.md`.
