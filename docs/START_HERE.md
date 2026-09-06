# Start here: teach with Market Lab or change it with your agent

## Teach the class

No coding setup is needed to teach. Open https://stocks.mikesego.com/teacher/games and sign in/create your teacher account. Create your own season, set dates and rules, and add students in Roster using aliases and individual PINs. Students need no email accounts. Keep a private login-to-tablet list; the shared demonstration account is for practice only.

On each tablet, while on good Wi-Fi: use regular Silk, sign in at https://stocks.mikesego.com/join, open https://stocks.mikesego.com/classroom, label the tablet, and choose **Prepare this device**. Wait for **Ready for offline use** and **All trades backed up**, bookmark Classroom, then test Wi-Fi-off reload and close/reopen. Download any additional investment symbols before class. Use one assigned tablet per student portfolio. Fifteen is an example, not a limit.

Trading completes instantly at the saved price, including offline and closed markets. Real IEX prices refresh about every 60–75 seconds while online and visible, and on reopening/reconnection. Old trades retain their original prices. After class, reconnect all tablets while charging with Classroom open/visible; backups and prices update automatically. Check every device's recent check-in on your season's **Classroom devices** page. Sleeping tablets/closed browsers do not have a guaranteed background update schedule.

The full operating/recovery guide is [CLASSROOM_OFFLINE.md](CLASSROOM_OFFLINE.md), also available at https://stocks.mikesego.com/classroom-guide. Never clear Silk storage or change students while trades are awaiting backup. Sync, then **Release this device**, before reassignment.

## One-time computer setup: instructions for Codex or Claude Code

Sonia is a teacher, not an engineer. Run these steps yourself when she asks for setup. Inspect what already exists, avoid overwriting her files, and explain each meaningful step briefly. Ask her to interact only for her own sign-in, account creation, invitation acceptance, or operating-system dialogs. Do not impersonate Mike or reuse his personal credentials. Account invitations and access grants are separate from cloning this public repository.

### 1. Verify accounts and tools

Use a local coding-capable session with access to a folder and terminal (Codex desktop/local CLI or Claude Code). An ordinary chat or downloaded ZIP alone cannot push changes. Check/install Git, Node.js 24 LTS (matching Vercel), npm, GitHub CLI (`gh`), Vercel CLI (`vercel`), and Playwright's Chromium browser. Use official installers/package sources suitable for her OS; do not copy another machine's paths.

Sonia needs:

- Her own GitHub account, verified email, and accepted collaborator invitation for `mikesego/market-lab`. The repo is public, so being able to view/clone it does **not** prove write access.
- Her own Vercel account and accepted invitation to team `mikesegos-projects`, with a role that can deploy/promote/roll back and access the project configuration. Connect the same GitHub account to Vercel so commit attribution is recognized.
- Her own teacher sign-in at Market Lab. This is independent of GitHub/Vercel and grants her access to seasons she creates.

Check `gh auth status`, `gh api user --jq .login`, `vercel whoami`, and `vercel teams ls`. If needed, run `gh auth login --hostname github.com --git-protocol https --web`, `gh auth setup-git`, and `vercel login`; let Sonia complete the browser flows. Verify repository push permission with `gh repo view mikesego/market-lab --json viewerPermission` and confirm the Vercel project is accessible. If an invitation is missing/expired, give Mike the exact GitHub username or Vercel account email and role needed; do not claim access is ready.

### 2. Clone and orient

```sh
gh repo clone mikesego/market-lab
cd market-lab
```

If she already has a checkout, inspect `git status` and `git remote -v`, preserve uncommitted work, and fetch changes instead of cloning over it. Read `AGENTS.md`, `docs/AGENT_HANDOFF.md`, this file, and `docs/CLASSROOM_OFFLINE.md` before changing code. Configure Git's author name/email to Sonia's own verified GitHub identity (a GitHub-provided private no-reply email is fine), never Mike's identity.

### 3. Link the existing service and obtain local settings

```sh
npm ci
vercel link --yes --scope mikesegos-projects --project market-lab
vercel env pull .env.local --environment=development --scope mikesegos-projects
npx playwright install chromium
```

First check whether `.env.local` already exists; preserve it instead of overwriting it. Verify `.vercel/project.json` identifies the project in the handoff. Link the existing project; do not create a second production service.

Environment values belong in ignored `.env.local`, obtained through Sonia's authorized Vercel session, never pasted in chat, email, or Git. Development target has the database, Clerk development keys, and market-data credentials. Compare variable **names/presence** against `.env.example`, without printing values. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` locally. Generate independent local `STUDENT_AUTH_PEPPER` and `CRON_SECRET` with cryptographic randomness if absent; do not rotate production secrets. Retain `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/teacher/sign-in`. Verify both database connection variables and both Alpaca keys are populated. Production-sensitive values may not be exportable, and are not required for normal local development.

**Current database wiring is shared:** Development/Preview/Production variables are configured across the same Neon integration. Treat the pulled database as live until independently verified otherwise. A localhost page or preview URL does not isolate data. Do not automatically seed, reset, or migrate the shared database just to set up a laptop. Use an empty disposable local Postgres database or an explicitly provisioned isolated Neon branch for destructive tests or reset/seed work. Override both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` together when isolating it. On a newly created disposable database, run `npm run db:migrate`, then `npm run db:seed`.

### 4. Verify local operation

Run `npm run check`, then `npm run dev` and inspect http://localhost:3000 and http://localhost:3000/classroom. The prebuild/predev steps generate the offline assets automatically. Verify the teacher login flow using the local Clerk environment. Development Clerk identities and teacher seasons can differ from production; create a test season under the appropriate identity rather than trying to bypass ownership checks.

For browser tests, see [TESTING.md](TESTING.md). `tests/e2e/classroom.spec.ts` writes UUID-owned fixture records through the database and real API, then cleans those records up. Its local database must match the server under test. `core-flows.spec.ts` submits an order to the shared demo portfolio; it is not a read-only smoke test. Prefer isolated data for full testing. Never reset a class to make tests pass.

Setup is complete when the local site opens, required settings are present, repository write permission is confirmed, Vercel project access is confirmed, and Sonia knows the classroom and release commands. Do not push a fake edit just to prove access. Her first requested change is the final end-to-end deployment acceptance check.

## Make a change and put it live

Sonia can say: “Make the buy/sell buttons easier for my students to read,” or “Fix this bug; here is what I clicked and what happened.” Reproduce it, implement the change, verify it, and show the result. Routine roster/rule/assignment changes belong in the teacher interface and need no code deployment.

When she says “put it live,” “ship it,” or “push through production,” handle the following without asking her to operate Git:

1. Inspect the working tree and fetch `origin`. Preserve unrelated work. Work on `main` for straightforward changes, as this project has done; use a branch when concurrent work or a preview warrants one. Never force-push shared `main`.
2. Reconcile any newer remote changes before final validation. Run `npm run check` and the tests relevant to the affected flow. For changes touching money, storage, synchronization, or cached clients, run the classroom regression suite and relevant offline checks. Resolve failures before publishing.
3. Review the staged diff for secrets, student data, unwanted generated assets, and migrations. Commit only the intended files with a clear message. If remote changes arrived, integrate them and revalidate the affected code.
4. Apply any required reviewed migration to the explicitly verified target database before code that needs it. Migrations `0006`/`0007` already exist in production; do not re-create the classroom schema or seed the live class. Preserve backward compatibility for old offline clients. Record migration status in the handoff.
5. `git push origin main` is the usual production release. Native Vercel Git integration builds it. Do not add a token-based GitHub Actions deploy workflow. A GitHub push is not proof of a successful deploy.
6. Use the Vercel dashboard or `vercel ls market-lab --prod --scope mikesegos-projects`, then `vercel inspect <deployment-url> --wait --timeout 60s` to confirm **Ready**, the intended commit, and the custom domain. Inspect build logs if it fails. Read-only smoke checks: `/api/health`, `/classroom`, `/classroom/sw.js`, `/classroom-guide`, and the actual changed flow. Check runtime errors with `vercel logs <deployment-url> --level error --since 10m`.
7. Report what changed, test results, the live URL, and any remaining limitation. Update `docs/AGENT_HANDOFF.md` and `docs/CHANGELOG.md` with durable findings. Do not say “deployed” if Vercel is still building or blocked on account membership.

Manual deployment, when needed, uses the same linked project: `vercel deploy --prod --scope mikesegos-projects`. Never use a personal token sent by Mike as a substitute for Sonia's own access.

## Undo a bad release

For an app-code regression, restore the known-good production deployment through the Vercel dashboard or `vercel rollback <known-good-deployment-url> --scope mikesegos-projects`, then verify the live site. Inspect the current CLI help if necessary. Follow with a reviewed corrective/revert commit so the next Git deploy cannot reintroduce the problem. Code rollback does not reverse database migrations or erase trades already executed; handle data repair separately with an auditable, narrowly scoped plan.

Offline tablets may still run an older cached app. Back up their trades before updating; reconnect, close old Classroom tabs, and reopen to activate a waiting service worker. Never delete browser storage as an update procedure.

## What may still require the account owner

Missing/expired GitHub or Vercel invitations, billing/team-role changes, Cloudflare DNS ownership, and direct Clerk/Neon/Alpaca console membership may require Mike. Normal editing and deployment should use Sonia's accounts once access is accepted. Do not grant broader platform access, transfer a class, purchase a plan, or change DNS merely to make a routine code edit.

Starter prompt for a new agent:

> This is Market Lab, https://github.com/mikesego/market-lab. Read AGENTS.md, docs/AGENT_HANDOFF.md, docs/START_HERE.md, and docs/CLASSROOM_OFFLINE.md. Help me finish local setup using my own GitHub and Vercel accounts. Handle the technical work and ask me only for sign-in or other necessary human steps. Preserve classroom data and offline trading behavior. Then help me make, test, and publish the changes I request.
