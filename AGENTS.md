# Market Lab: instructions for coding agents

Read `docs/AGENT_HANDOFF.md` first for current behavior and known limits, then `docs/START_HERE.md` for setup and publishing. `docs/CLASSROOM_OFFLINE.md` is the classroom operating guide. These repository files are the shared source of context for Codex and Claude Code; do not rely on another agent's private memory or Mike-specific tools.

Sonia is an authorized teacher and maintainer. Help her implement, verify, and publish requested improvements using her own GitHub/Vercel accounts. Handle the technical work; explain results in plain language. “Put it live” authorizes the ordinary tested commit/push/deploy workflow described in START_HERE. Confirm actual platform access and invitation acceptance; documentation alone does not grant permissions.

- Production: https://stocks.mikesego.com. GitHub: `mikesego/market-lab`, `main`. Vercel: `market-lab` under `mikesegos-projects`. Native Git pushes to main deploy production. Keep DNS in Cloudflare.
- `/classroom` trades execute immediately at the last saved price, offline or online, even outside market hours. Reconnect backs them up without repricing. Preserve this owner-approved behavior; do not reintroduce old demo-only/online-only restrictions.
- There is no fixed classroom tablet-count limit; 15 is a setup example. One assigned browser per student portfolio prevents disconnected double spending.
- Protect durable receipts, decimal accounting, retry idempotency, price provenance, corporate-action reconciliation, and existing offline clients. Never clear storage to hide a sync problem.
- Treat database connections as live unless verified isolated. Local/Preview settings currently share the Neon integration with Production. Do not auto-seed/reset/migrate merely to boot a laptop. Use the teacher UI for normal class changes, and scoped auditable changes for necessary repairs.
- The repository is public. Never commit credentials, `.env.local`, student data, device backups, PIN lists, or access-invitation links. Pull settings through the maintainer's authorized Vercel account.
- Preserve existing work and concurrent commits. Run `npm run check` and relevant behavioral tests before an application release; verify Vercel Ready, the intended commit, the custom domain, and the changed flow afterward. Never force-push main or claim a pending deploy succeeded.
- Keep `docs/AGENT_HANDOFF.md` and `docs/CHANGELOG.md` current after substantive changes. `PRODUCT_SPEC.md` contains broader historical requirements; the current classroom decisions and code take precedence where older sections differ.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
